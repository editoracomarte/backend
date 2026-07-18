import type { Schema, Struct } from '@strapi/strapi';

export interface AddressAddress extends Struct.ComponentSchema {
  collectionName: 'components_address_addresses';
  info: {
    displayName: 'address';
    icon: 'house';
  };
  attributes: {
    cep: Schema.Attribute.String;
    city: Schema.Attribute.String;
    complement1: Schema.Attribute.String;
    complement2: Schema.Attribute.String;
    country: Schema.Attribute.String;
    district: Schema.Attribute.String;
    state: Schema.Attribute.String;
    street: Schema.Attribute.String;
  };
}

export interface MidiaUrl extends Struct.ComponentSchema {
  collectionName: 'components_midia_urls';
  info: {
    displayName: 'URL';
    icon: 'cursor';
  };
  attributes: {
    label: Schema.Attribute.String;
    url: Schema.Attribute.String & Schema.Attribute.Required & Schema.Attribute.Unique;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'address.address': AddressAddress;
      'midia.url': MidiaUrl;
    }
  }
}
