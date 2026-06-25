import Logo from "./extensions/logo.svg";
import Favicon from "./extensions/favicon.ico";

export default {
  config: {
    auth: {
      logo: Logo,
    },
    head: {
      favicon: Favicon,
    },
    locales: ['pt-BR'],
    menu: {
      logo: Logo,
    },
    notifications: {
      releases: false
    },
    tutorials: false,
  },
  bootstrap() {},
};