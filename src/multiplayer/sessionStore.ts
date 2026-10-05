export interface KeyStore {get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>;remove(key:string):Promise<void>}
/** Native-only encrypted room credentials. Service credentials never enter this store. */
export const secureSessionStore:KeyStore={
 async get(key){const s=await import('expo-secure-store');return s.getItemAsync(key);},
 async set(key,value){const s=await import('expo-secure-store');await s.setItemAsync(key,value);},
 async remove(key){const s=await import('expo-secure-store');await s.deleteItemAsync(key);},
};
