import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/dashboard','/auth','/login','/signup','/recover','/open']},sitemap:'https://foundkeep.app/sitemap.xml'};}
