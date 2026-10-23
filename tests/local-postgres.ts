import { createRequire } from "node:module";
import path from "node:path";

type Result<T>={rows:T[];command:string};
type Client={connect():Promise<void>;end():Promise<void>;query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<Result<T>|Result<T>[]>};
const localRequire=createRequire(path.resolve("test-results/day4-postgres-tools/package.json"));
export async function localPostgresConnection(bootstrapped=false) {
  const port=Number(process.env.FAIRWORK_LOCAL_POSTGRES_PORT);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("Use the isolated local PostgreSQL runner");
  const {Client:PgClient}=localRequire("pg") as {Client:new(config:Record<string,unknown>)=>Client};
  const client=new PgClient({host:"127.0.0.1",port,user:bootstrapped?"fixture_bootstrap":"postgres",database:"postgres",password:"",ssl:false,connectionTimeoutMillis:5000});
  await client.connect();
  const identity=await client.query<{name:string}>("select current_setting('cluster_name') name");
  if(Array.isArray(identity)||identity.rows[0]?.name!=="fairwork_day4_disposable") {await client.end();throw new Error("Refusing to run fixtures on an unmarked cluster");}
  return {
    async query<T=Record<string,unknown>>(sql:string,params:unknown[]=[]) {const result=await client.query<T>(sql,params);if(Array.isArray(result))throw new Error("Expected one query result");return result;},
    async exec(sql:string) {const result=await client.query(sql);return Array.isArray(result)?result:[result];},
    close:()=>client.end(),
  };
}
