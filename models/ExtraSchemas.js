const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Array of organizations this user belongs to
  organizations: [{
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      required: true
    },
    permissions: {
      type: Map,
      of: Boolean,
      default: new Map()
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    }
  }],
  profile: {
    avatar: String,
    phone: String,
    timezone: String
  }
}, {
  timestamps: true
});

// Organization Schema
const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Array of members in this organization
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      required: true
    },
    permissions: {
      type: Map,
      of: Boolean,
      default: new Map()
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    }
  }],
  settings: {
    allowInvitations: {
      type: Boolean,
      default: true
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    maxMembers: {
      type: Number,
      default: 100
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Invitation Schema
const invitationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'member', 'viewer'],
    required: true
  },
  permissions: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  acceptedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Session Schema (for tracking active sessions)
const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  ipAddress: String,
  userAgent: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Audit Log Schema (for tracking user actions)
const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  action: {
    type: String,
    required: true
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ 'organizations.organizationId': 1 });
userSchema.index({ 'organizations.role': 1 });

organizationSchema.index({ slug: 1 });
organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ 'members.userId': 1 });
organizationSchema.index({ 'members.role': 1 });

invitationSchema.index({ email: 1, organizationId: 1 });
invitationSchema.index({ token: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ status: 1 });

sessionSchema.index({ userId: 1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

auditLogSchema.index({ userId: 1, organizationId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Methods for User Schema
userSchema.methods.getOrganizationRole = function(organizationId) {
  const org = this.organizations.find(o => 
    o.organizationId.toString() === organizationId.toString()
  );
  return org ? org.role : null;
};

userSchema.methods.hasPermission = function(organizationId, permission) {
  const org = this.organizations.find(o => 
    o.organizationId.toString() === organizationId.toString()
  );
  if (!org || org.status !== 'active') return false;
  
  // Owner and admin have all permissions
  if (org.role === 'owner' || org.role === 'admin') return true;
  
  // Check specific permission
  return org.permissions.get(permission) === true;
};

// Methods for Organization Schema
organizationSchema.methods.addMember = function(userId, role, invitedBy, permissions = new Map()) {
  // Remove existing member if exists
  this.members = this.members.filter(m => 
    m.userId.toString() !== userId.toString()
  );
  
  // Add new member
  this.members.push({
    userId,
    role,
    invitedBy,
    permissions,
    joinedAt: new Date(),
    status: 'active'
  });
  
  return this.save();
};

organizationSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => 
    m.userId.toString() !== userId.toString()
  );
  return this.save();
};

organizationSchema.methods.updateMemberRole = function(userId, newRole, permissions) {
  const member = this.members.find(m => 
    m.userId.toString() === userId.toString()
  );
  if (member) {
    member.role = newRole;
    if (permissions) member.permissions = permissions;
  }
  return this.save();
};

// Create Models
const User = mongoose.model('User', userSchema);
const Organization = mongoose.model('Organization', organizationSchema);
const Invitation = mongoose.model('Invitation', invitationSchema);
const Session = mongoose.model('Session', sessionSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
  User,
  Organization,
  Invitation,
  Session,
  AuditLog
};