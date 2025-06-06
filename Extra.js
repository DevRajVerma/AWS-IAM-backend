const { User, Organization, Invitation, Session, AuditLog } = require('./schemas');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class AuthService {
  // Create Organization (Owner Registration)
  async createOrganization(userData, orgData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Create user
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = new User({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: hashedPassword,
        emailVerified: userData.emailVerified || false
      });
      
      await user.save({ session });
      
      // Create organization
      const organization = new Organization({
        name: orgData.name,
        description: orgData.description,
        slug: orgData.slug,
        ownerId: user._id,
        members: [{
          userId: user._id,
          role: 'owner',
          joinedAt: new Date(),
          status: 'active'
        }]
      });
      
      await organization.save({ session });
      
      // Update user with organization reference
      user.organizations.push({
        organizationId: organization._id,
        role: 'owner',
        joinedAt: new Date(),
        status: 'active'
      });
      
      await user.save({ session });
      
      await session.commitTransaction();
      return { user, organization };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Send Invitation
  async sendInvitation(organizationId, inviterUserId, email, role, permissions = new Map()) {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Check if already a member
      const isMember = existingUser.organizations.some(org => 
        org.organizationId.toString() === organizationId.toString()
      );
      if (isMember) {
        throw new Error('User is already a member of this organization');
      }
    }
    
    // Check for existing pending invitation
    const existingInvitation = await Invitation.findOne({
      organizationId,
      email,
      status: 'pending'
    });
    
    if (existingInvitation) {
      throw new Error('Invitation already sent to this email');
    }
    
    // Create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const invitation = new Invitation({
      organizationId,
      email,
      role,
      permissions,
      invitedBy: inviterUserId,
      token
    });
    
    await invitation.save();
    
    // Log audit event
    await this.logAudit(inviterUserId, organizationId, 'INVITATION_SENT', 'invitation', invitation._id, {
      email,
      role
    });
    
    return invitation;
  }
  
  // Accept Invitation
  async acceptInvitation(token, userId) {
    const invitation = await Invitation.findOne({
      token,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).populate('organizationId');
    
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      const organization = await Organization.findById(invitation.organizationId._id).session(session);
      
      // Add user to organization
      await organization.addMember(userId, invitation.role, invitation.invitedBy, invitation.permissions);
      
      // Add organization to user
      user.organizations.push({
        organizationId: invitation.organizationId._id,
        role: invitation.role,
        permissions: invitation.permissions,
        joinedAt: new Date(),
        invitedBy: invitation.invitedBy,
        status: 'active'
      });
      
      await user.save({ session });
      
      // Update invitation status
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitation.save({ session });
      
      await session.commitTransaction();
      
      // Log audit event
      await this.logAudit(userId, invitation.organizationId._id, 'INVITATION_ACCEPTED', 'invitation', invitation._id);
      
      return { user, organization };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Add User Directly (Admin adds user)
  async addUserDirectly(organizationId, adminUserId, userData, role, permissions = new Map()) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      let user = await User.findOne({ email: userData.email }).session(session);
      let isNewUser = false;
      
      if (!user) {
        // Create new user
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        
        user = new User({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          passwordHash: hashedPassword,
          emailVerified: false
        });
        
        await user.save({ session });
        isNewUser = true;
      }
      
      // Check if already a member
      const isMember = user.organizations.some(org => 
        org.organizationId.toString() === organizationId.toString()
      );
      
      if (isMember) {
        throw new Error('User is already a member of this organization');
      }
      
      const organization = await Organization.findById(organizationId).session(session);
      
      // Add to organization
      await organization.addMember(user._id, role, adminUserId, permissions);
      
      // Add to user
      user.organizations.push({
        organizationId,
        role,
        permissions,
        joinedAt: new Date(),
        invitedBy: adminUserId,
        status: 'active'
      });
      
      await user.save({ session });
      
      await session.commitTransaction();
      
      // Log audit event
      await this.logAudit(adminUserId, organizationId, 'USER_ADDED_DIRECTLY', 'user', user._id, {
        email: userData.email,
        role,
        isNewUser
      });
      
      return { user, organization, isNewUser };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Update User Role
  async updateUserRole(organizationId, adminUserId, targetUserId, newRole, permissions) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(targetUserId).session(session);
      const organization = await Organization.findById(organizationId).session(session);
      
      // Update in organization
      await organization.updateMemberRole(targetUserId, newRole, permissions);
      
      // Update in user
      const userOrg = user.organizations.find(org => 
        org.organizationId.toString() === organizationId.toString()
      );
      
      if (userOrg) {
        userOrg.role = newRole;
        if (permissions) userOrg.permissions = permissions;
        await user.save({ session });
      }
      
      await session.commitTransaction();
      
      // Log audit event
      await this.logAudit(adminUserId, organizationId, 'USER_ROLE_UPDATED', 'user', targetUserId, {
        newRole,
        permissions: Object.fromEntries(permissions || new Map())
      });
      
      return { user, organization };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Remove User from Organization
  async removeUser(organizationId, adminUserId, targetUserId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(targetUserId).session(session);
      const organization = await Organization.findById(organizationId).session(session);
      
      // Remove from organization
      await organization.removeMember(targetUserId);
      
      // Remove from user
      user.organizations = user.organizations.filter(org => 
        org.organizationId.toString() !== organizationId.toString()
      );
      await user.save({ session });
      
      await session.commitTransaction();
      
      // Log audit event
      await this.logAudit(adminUserId, organizationId, 'USER_REMOVED', 'user', targetUserId);
      
      return { user, organization };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Get Organization Members
  async getOrganizationMembers(organizationId, page = 1, limit = 20) {
    const organization = await Organization.findById(organizationId)
      .populate({
        path: 'members.userId',
        select: 'firstName lastName email emailVerified createdAt'
      })
      .populate({
        path: 'members.invitedBy',
        select: 'firstName lastName email'
      });
    
    if (!organization) {
      throw new Error('Organization not found');
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const members = organization.members
      .filter(member => member.status === 'active')
      .slice(startIndex, endIndex);
    
    return {
      members,
      total: organization.members.filter(m => m.status === 'active').length,
      page,
      limit
    };
  }
  
  // Check User Permission
  async checkPermission(userId, organizationId, permission) {
    const user = await User.findById(userId);
    if (!user) return false;
    
    return user.hasPermission(organizationId, permission);
  }
  
  // Log Audit Event
  async logAudit(userId, organizationId, action, resource, resourceId, details = {}) {
    const auditLog = new AuditLog({
      userId,
      organizationId,
      action,
      resource,
      resourceId,
      details
    });
    
    await auditLog.save();
  }
}

module.exports = AuthService;