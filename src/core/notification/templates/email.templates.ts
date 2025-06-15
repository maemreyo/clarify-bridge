//  Email template definitions

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const EMAIL_TEMPLATES: Record<string, (data: any) => EmailTemplate> = {
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
};

// ============================================
