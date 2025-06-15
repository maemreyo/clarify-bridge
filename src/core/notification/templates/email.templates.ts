//  Email template definitions

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const EMAIL_TEMPLATES: Record<string, (data: any) => EmailTemplate> = {
  // General templates
  WELCOME: (data: { name: string }) => ({
    subject: 'Welcome to The Clarity Bridge!',
    text: `Hi ${data.name},\n\nWelcome to The Clarity Bridge! We're excited to have you on board.\n\nGet started by creating your first specification.\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to The Clarity Bridge!</h1>
        <p>Hi ${data.name},</p>
        <p>We're excited to have you on board. The Clarity Bridge helps you transform requirements into clear, actionable specifications.</p>
        <p>Get started by creating your first specification.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Go to Dashboard</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  PASSWORD_RESET: (data: { name: string; resetLink: string }) => ({
    subject: 'Reset your password',
    text: `Hi ${data.name},\n\nYou requested to reset your password. Click the link below to reset it:\n\n${data.resetLink}\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${data.name},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <a href="${data.resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p style="margin-top: 20px; color: #666;">If you didn't request this, please ignore this email.</p>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  // Specification events
  SPEC_CREATED: (data: { name: string; specTitle: string; specId: string }) => ({
    subject: `New specification "${data.specTitle}" created`,
    text: `Hi ${data.name},\n\nA new specification "${data.specTitle}" has been created.\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Specification Created</h2>
        <p>Hi ${data.name},</p>
        <p>A new specification "<strong>${data.specTitle}</strong>" has been created.</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">View Specification</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SPEC_UPDATED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    updatedBy?: string;
  }) => ({
    subject: `Specification "${data.specTitle}" has been updated`,
    text: `Hi ${data.name},\n\nThe specification "${data.specTitle}"${data.updatedBy ? ` has been updated by ${data.updatedBy}` : ' has been updated'}.\n\nView the changes here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Specification Updated</h2>
        <p>Hi ${data.name},</p>
        <p>The specification "<strong>${data.specTitle}</strong>"${data.updatedBy ? ` has been updated by <strong>${data.updatedBy}</strong>` : ' has been updated'}.</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #ffc107; color: #212529; text-decoration: none; border-radius: 4px;">View Changes</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SPEC_APPROVED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    approvedBy?: string;
  }) => ({
    subject: `Specification "${data.specTitle}" has been approved`,
    text: `Hi ${data.name},\n\nGood news! The specification "${data.specTitle}"${data.approvedBy ? ` has been approved by ${data.approvedBy}` : ' has been approved'}.\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Specification Approved</h2>
        <p>Hi ${data.name},</p>
        <p>Good news! The specification "<strong>${data.specTitle}</strong>"${data.approvedBy ? ` has been approved by <strong>${data.approvedBy}</strong>` : ' has been approved'}.</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">View Specification</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SPEC_REJECTED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    rejectedBy?: string;
    reason?: string;
  }) => ({
    subject: `Specification "${data.specTitle}" requires changes`,
    text: `Hi ${data.name},\n\nThe specification "${data.specTitle}"${data.rejectedBy ? ` has been reviewed by ${data.rejectedBy} and` : ''} requires some changes.${data.reason ? `\n\nReason: ${data.reason}` : ''}\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Specification Requires Changes</h2>
        <p>Hi ${data.name},</p>
        <p>The specification "<strong>${data.specTitle}</strong>"${data.rejectedBy ? ` has been reviewed by <strong>${data.rejectedBy}</strong> and` : ''} requires some changes.</p>
        ${data.reason ? `<p style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #dc3545;"><strong>Feedback:</strong> ${data.reason}</p>` : ''}
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">Review Specification</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SPEC_COMPLETED: (data: { name: string; specTitle: string; specId: string }) => ({
    subject: `Your specification "${data.specTitle}" is ready!`,
    text: `Hi ${data.name},\n\nYour specification "${data.specTitle}" has been generated successfully.\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your specification is ready!</h2>
        <p>Hi ${data.name},</p>
        <p>Your specification "<strong>${data.specTitle}</strong>" has been generated successfully.</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">View Specification</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  // Collaboration events
  COMMENT_ADDED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    commentBy: string;
    commentContent?: string;
  }) => ({
    subject: `New comment on "${data.specTitle}"`,
    text: `Hi ${data.name},\n\n${data.commentBy} has added a comment on the specification "${data.specTitle}".${data.commentContent ? `\n\nComment: "${data.commentContent}"` : ''}\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Comment</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.commentBy}</strong> has added a comment on the specification "<strong>${data.specTitle}</strong>".</p>
        ${data.commentContent ? `<p style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #6c757d;">"${data.commentContent}"</p>` : ''}
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px;">View Comment</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  COMMENT_REPLY: (data: {
    name: string;
    specTitle: string;
    specId: string;
    replyBy: string;
    replyContent?: string;
  }) => ({
    subject: `New reply to your comment on "${data.specTitle}"`,
    text: `Hi ${data.name},\n\n${data.replyBy} has replied to your comment on the specification "${data.specTitle}".${data.replyContent ? `\n\nReply: "${data.replyContent}"` : ''}\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Reply to Your Comment</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.replyBy}</strong> has replied to your comment on the specification "<strong>${data.specTitle}</strong>".</p>
        ${data.replyContent ? `<p style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #17a2b8;">"${data.replyContent}"</p>` : ''}
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 4px;">View Reply</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  REVIEW_REQUESTED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    requestedBy: string;
  }) => ({
    subject: `Review requested for "${data.specTitle}"`,
    text: `Hi ${data.name},\n\n${data.requestedBy} has requested your review on the specification "${data.specTitle}".\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Review Requested</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.requestedBy}</strong> has requested your review on the specification "<strong>${data.specTitle}</strong>".</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Review Specification</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  REVIEW_COMPLETED: (data: {
    name: string;
    specTitle: string;
    specId: string;
    reviewedBy: string;
    status: string;
  }) => ({
    subject: `Review completed for "${data.specTitle}"`,
    text: `Hi ${data.name},\n\n${data.reviewedBy} has completed their review of the specification "${data.specTitle}" with status: ${data.status}.\n\nView it here: ${process.env.FRONTEND_URL}/specifications/${data.specId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Review Completed</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.reviewedBy}</strong> has completed their review of the specification "<strong>${data.specTitle}</strong>" with status: <strong>${data.status}</strong>.</p>
        <a href="${process.env.FRONTEND_URL}/specifications/${data.specId}" style="display: inline-block; padding: 12px 24px; background-color: #6f42c1; color: white; text-decoration: none; border-radius: 4px;">View Review</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  // Team events
  TEAM_INVITATION: (data: {
    inviteeName: string;
    teamName: string;
    inviterName: string;
    inviteLink: string;
  }) => ({
    subject: `You've been invited to join "${data.teamName}"`,
    text: `Hi ${data.inviteeName},\n\n${data.inviterName} has invited you to join the team "${data.teamName}" on The Clarity Bridge.\n\nAccept invitation: ${data.inviteLink}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Team Invitation</h2>
        <p>Hi ${data.inviteeName},</p>
        <p><strong>${data.inviterName}</strong> has invited you to join the team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <a href="${data.inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Accept Invitation</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  MEMBER_JOINED: (data: {
    name: string;
    teamName: string;
    memberName: string;
    teamId: string;
  }) => ({
    subject: `${data.memberName} has joined ${data.teamName}`,
    text: `Hi ${data.name},\n\n${data.memberName} has joined your team "${data.teamName}" on The Clarity Bridge.\n\nView team: ${process.env.FRONTEND_URL}/teams/${data.teamId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Team Member</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.memberName}</strong> has joined your team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <a href="${process.env.FRONTEND_URL}/teams/${data.teamId}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">View Team</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  MEMBER_LEFT: (data: { name: string; teamName: string; memberName: string; teamId: string }) => ({
    subject: `${data.memberName} has left ${data.teamName}`,
    text: `Hi ${data.name},\n\n${data.memberName} is no longer a member of the team "${data.teamName}" on The Clarity Bridge.\n\nView team: ${process.env.FRONTEND_URL}/teams/${data.teamId}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Team Member Left</h2>
        <p>Hi ${data.name},</p>
        <p><strong>${data.memberName}</strong> is no longer a member of the team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <a href="${process.env.FRONTEND_URL}/teams/${data.teamId}" style="display: inline-block; padding: 12px 24px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px;">View Team</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  // Integration events
  INTEGRATION_CREATED: (data: {
    name: string;
    teamName: string;
    integrationType: string;
    teamId: string;
  }) => ({
    subject: `New ${data.integrationType} integration for ${data.teamName}`,
    text: `Hi ${data.name},\n\nA new ${data.integrationType} integration has been set up for the team "${data.teamName}" on The Clarity Bridge.\n\nView integrations: ${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Integration</h2>
        <p>Hi ${data.name},</p>
        <p>A new <strong>${data.integrationType}</strong> integration has been set up for the team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <a href="${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">View Integrations</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  INTEGRATION_ERROR: (data: {
    name: string;
    teamName: string;
    integrationType: string;
    errorMessage: string;
    teamId: string;
  }) => ({
    subject: `Error with ${data.integrationType} integration for ${data.teamName}`,
    text: `Hi ${data.name},\n\nThere was an error with the ${data.integrationType} integration for the team "${data.teamName}" on The Clarity Bridge.\n\nError: ${data.errorMessage}\n\nPlease check your integration settings: ${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Integration Error</h2>
        <p>Hi ${data.name},</p>
        <p>There was an error with the <strong>${data.integrationType}</strong> integration for the team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <p style="padding: 15px; background-color: #f8d7da; border-left: 4px solid #dc3545; color: #721c24;"><strong>Error:</strong> ${data.errorMessage}</p>
        <a href="${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">Check Integration Settings</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  INTEGRATION_REMOVED: (data: {
    name: string;
    teamName: string;
    integrationType: string;
    teamId: string;
  }) => ({
    subject: `${data.integrationType} integration removed from ${data.teamName}`,
    text: `Hi ${data.name},\n\nThe ${data.integrationType} integration has been removed from the team "${data.teamName}" on The Clarity Bridge.\n\nView integrations: ${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Integration Removed</h2>
        <p>Hi ${data.name},</p>
        <p>The <strong>${data.integrationType}</strong> integration has been removed from the team "<strong>${data.teamName}</strong>" on The Clarity Bridge.</p>
        <a href="${process.env.FRONTEND_URL}/teams/${data.teamId}/integrations" style="display: inline-block; padding: 12px 24px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px;">View Integrations</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  // System events
  USAGE_LIMIT_WARNING: (data: {
    name: string;
    usagePercentage: number;
    usageLimit: number;
    currentUsage: number;
  }) => ({
    subject: 'Usage limit warning',
    text: `Hi ${data.name},\n\nYou have used ${data.usagePercentage}% of your monthly usage limit (${data.currentUsage}/${data.usageLimit}).\n\nConsider upgrading your plan to avoid any service interruptions: ${process.env.FRONTEND_URL}/account/subscription\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Usage Limit Warning</h2>
        <p>Hi ${data.name},</p>
        <p>You have used <strong>${data.usagePercentage}%</strong> of your monthly usage limit (${data.currentUsage}/${data.usageLimit}).</p>
        <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; margin: 20px 0;">
          <div style="background-color: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
            <div style="background-color: ${data.usagePercentage > 90 ? '#dc3545' : '#ffc107'}; height: 100%; width: ${Math.min(data.usagePercentage, 100)}%;"></div>
          </div>
          <p style="text-align: center; margin-top: 10px; font-size: 14px;">${data.currentUsage} of ${data.usageLimit} specifications</p>
        </div>
        <p>Consider upgrading your plan to avoid any service interruptions.</p>
        <a href="${process.env.FRONTEND_URL}/account/subscription" style="display: inline-block; padding: 12px 24px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 4px;">Upgrade Plan</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SUBSCRIPTION_EXPIRING: (data: { name: string; expiryDate: string; daysLeft: number }) => ({
    subject: 'Your subscription is expiring soon',
    text: `Hi ${data.name},\n\nYour subscription to The Clarity Bridge will expire in ${data.daysLeft} days (${data.expiryDate}).\n\nRenew your subscription to avoid any service interruptions: ${process.env.FRONTEND_URL}/account/subscription\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Subscription Expiring Soon</h2>
        <p>Hi ${data.name},</p>
        <p>Your subscription to The Clarity Bridge will expire in <strong>${data.daysLeft} days</strong> (${data.expiryDate}).</p>
        <p>Renew your subscription to avoid any service interruptions.</p>
        <a href="${process.env.FRONTEND_URL}/account/subscription" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">Renew Subscription</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SUBSCRIPTION_UPDATE: (data: { name: string; planName: string; effectiveDate: string }) => ({
    subject: 'Your subscription has been updated',
    text: `Hi ${data.name},\n\nYour subscription to The Clarity Bridge has been updated to the ${data.planName} plan, effective from ${data.effectiveDate}.\n\nView your subscription details: ${process.env.FRONTEND_URL}/account/subscription\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Subscription Updated</h2>
        <p>Hi ${data.name},</p>
        <p>Your subscription to The Clarity Bridge has been updated to the <strong>${data.planName}</strong> plan, effective from ${data.effectiveDate}.</p>
        <a href="${process.env.FRONTEND_URL}/account/subscription" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">View Subscription Details</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SYSTEM_UPDATE: (data: { name: string; updateTitle: string; updateDetails: string }) => ({
    subject: `System Update: ${data.updateTitle}`,
    text: `Hi ${data.name},\n\nWe've made some updates to The Clarity Bridge: ${data.updateTitle}\n\n${data.updateDetails}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">System Update</h2>
        <p>Hi ${data.name},</p>
        <p>We've made some updates to The Clarity Bridge:</p>
        <div style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #007bff;">${data.updateTitle}</h3>
          <p>${data.updateDetails}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Go to Dashboard</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),

  SYSTEM_ALERT: (data: {
    name: string;
    alertTitle: string;
    alertDetails: string;
    severity?: string;
  }) => ({
    subject: `System Alert: ${data.alertTitle}`,
    text: `Hi ${data.name},\n\nImportant alert from The Clarity Bridge: ${data.alertTitle}\n\n${data.alertDetails}\n\nBest regards,\nThe Clarity Bridge Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">System Alert</h2>
        <p>Hi ${data.name},</p>
        <p>Important alert from The Clarity Bridge:</p>
        <div style="padding: 15px; background-color: ${data.severity === 'high' ? '#f8d7da' : data.severity === 'medium' ? '#fff3cd' : '#d1ecf1'}; border-left: 4px solid ${data.severity === 'high' ? '#dc3545' : data.severity === 'medium' ? '#ffc107' : '#17a2b8'}; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${data.severity === 'high' ? '#721c24' : data.severity === 'medium' ? '#856404' : '#0c5460'};">${data.alertTitle}</h3>
          <p>${data.alertDetails}</p>
        </div>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Clarity Bridge Team</p>
      </div>
    `,
  }),
};

// ============================================
