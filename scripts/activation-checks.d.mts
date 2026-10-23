export const pending: string[][];
export function inventory(): {name:string;version:string;sha256:string;tables:string[];functions:string[];policies:{name:string;table:string}[];indexes:string[]}[];
export function stageSQL(stage:number, options?:{history?:boolean}):string;
export function constraintSQL(stage:number, rows:{name:string;hash:string}[]):string;
