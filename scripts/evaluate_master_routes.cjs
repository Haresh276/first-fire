/* node scripts/evaluate_master_routes.cjs OUTPUT.json [--generalization|--third] [--router=PATH] */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.resolve(root,file),'utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const banks={
  first:['master-route-60','bab2c1b52d4f78d292b067a69ecfaba325ef9bba0074875a69514daf14c80243'],
  second:['master-route-generalization','ebead748ff5d55ba9d36c699d87e9eb821cb93872032cdce1bb0d661eca9f9d1'],
  third:['master-route-third','dde3983b32ba1d3d7c0d305d7dd5a6b84b230fbab3a85ccbbbdcde7e4d9ccaa5'],
};
const args=process.argv.slice(2);
const [bankName,sealed]=banks[args.includes('--third')?'third':args.includes('--generalization')?'second':'first'];
const bank=read('tests/chat/'+bankName+'.json'),routerFile=args.find(arg=>arg.startsWith('--router='))?.slice(9)||'site/intent-router.js',router=read(routerFile);
if(hash(bank)!==sealed)throw Error('Question bank differs from its seal.');
const env=vm.createContext({URLSearchParams,URL});
vm.runInContext('globalThis.window=globalThis',env);
for(const source of ['dist/records.js','dist/observation-rows.js','site/science-chat.js'])vm.runInContext(read(source),env);
vm.runInContext(router,env);
const cases=JSON.parse(bank).map(row=>{
  const actual=env.FFIntentRouter.detect(row.question,[],env.FF).type;
  return {...row,actual,pass:row.expected===actual};
});
const out={schema:'first-fire.intent-evaluation.v1',bankSHA256:hash(bank),routerSHA256:hash(router),count:cases.length,correct:cases.filter(row=>row.pass).length,cases};
const output=args.find(arg=>!arg.startsWith('--'));
if(output)fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(out.correct+'/'+out.count,cases.filter(q=>!q.pass).map(q=>q.id+' '+q.expected+' → '+q.actual).join(', '));
