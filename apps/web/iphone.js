import { customerConfig, renderIphoneLinks } from './customer.js?v=20260910-platforms';

const config = await customerConfig();
renderIphoneLinks(config);
document.querySelectorAll('[data-private-beta]').forEach(node => { node.hidden = config.iphone.distribution !== 'private-beta'; });
document.querySelectorAll('[data-iphone-public]').forEach(node => { node.hidden = config.iphone.distribution === 'private-beta'; });
