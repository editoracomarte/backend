import type { Core } from '@strapi/strapi';

export async function grantPublicAccess(
  strapi: Core.Strapi,
  contentType: string,
  actions: string[]
): Promise<void> {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  if (!publicRole) {
    throw new Error('Public role not found — users-permissions plugin not initialized?');
  }

  for (const action of actions) {
    const actionUid = `${contentType}.${action}`;
    const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
      where: { action: actionUid, role: publicRole.id },
    });
    if (!existing) {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: { action: actionUid, role: publicRole.id },
      });
    }
  }
}
