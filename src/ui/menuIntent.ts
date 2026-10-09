export type MenuIntent={type:'offline'}|{type:'load';id:string}|{type:'reconnect';id:string}|{type:'create';name:string}|{type:'join';name:string;code:string};
