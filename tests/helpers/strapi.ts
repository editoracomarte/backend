import { compileStrapi, createStrapi, type Core } from '@strapi/strapi';

let instance: Core.Strapi | null = null;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (!instance) {
    const compiled = await compileStrapi();
    instance = await createStrapi(compiled).load();
    await instance.server.mount();
  }
  return instance;
}

export async function cleanupStrapi(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
