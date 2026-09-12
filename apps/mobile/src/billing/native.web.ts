// Keep native StoreKit code out of web previews. Web checkout lives in the website.
import { createPurchasesController } from './controller.ts';
const unavailable=async():Promise<never>=>{throw new Error('App Store subscriptions are available in the iPhone app.');};
export const purchases=createPurchasesController({configure:()=>{},getAppUserID:unavailable,logIn:unavailable,logOut:unavailable,isAnonymous:unavailable,getOfferings:unavailable,purchasePackage:unavailable,restorePurchases:unavailable});
