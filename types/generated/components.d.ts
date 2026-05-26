import type { Schema, Struct } from '@strapi/strapi';

export interface MidiaUrl extends Struct.ComponentSchema {
  collectionName: 'components_midia_urls';
  info: {
    displayName: 'URL';
    icon: 'cursor';
  };
  attributes: {
    rotulo: Schema.Attribute.String;
    url: Schema.Attribute.String & Schema.Attribute.Required & Schema.Attribute.Unique;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'midia.url': MidiaUrl;
    }
  }
}
