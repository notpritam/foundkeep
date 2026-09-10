import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{return ['','/support','/privacy','/terms'].map(path=>({url:'https://foundkeep.app'+path,changeFrequency:'monthly',priority:path?0.5:1}));}
