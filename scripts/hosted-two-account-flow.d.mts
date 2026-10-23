type Actor = {id:string};
export function twoAccountFlow(options: {
  worker:Actor; employer:Actor; companyId:string;
  request:(actor:Actor,path:string,body?:Record<string,unknown>,statuses?:number[])=>Promise<unknown>;
  record:(label:string)=>void;
}):Promise<{offerId:string;agreementId:string;workId:string}>;
