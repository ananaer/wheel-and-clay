import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileContracts,toolRequire} from '../contracts/tools/compile.mjs';
import {encodePiece} from '../piece-link.js';

// 全部执行在内存 EVM；没有 RPC、钱包、私钥、签名或广播。
const {createVM}=toolRequire('@ethereumjs/vm');
const {createCustomCommon,Mainnet,Hardfork}=toolRequire('@ethereumjs/common');
const {createAddressFromString,Account,bytesToHex,hexToBytes}=toolRequire('@ethereumjs/util');
const {Interface,keccak256,AbiCoder}=toolRequire('ethers');
const {output,artifact}=compileContracts();
const kilnAbi=new Interface(artifact.abi);
const mockBuild=output.contracts['contracts/test/MockSqueekCore.sol'].MockSqueekCore,mockAbi=new Interface(mockBuild.abi);
const coreAddress='0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4';
const implementation='0x6869d6102696243fd17013ab955d99cd0c522ad3';
const layout='0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20';
const dataHash='0xaabbccdd'+'11'.repeat(28);
const maker='0x1000000000000000000000000000000000000001',other='0x2000000000000000000000000000000000000002';
const fixture=Buffer.from(encodePiece({profile:Array.from({length:129},(_,i)=>.56+.43*Math.sin(Math.PI*i/128)),form:'vase',glaze:'turquoise',surface:'flow',finish:.82,hadSim:true,companionId:'8891'}),'base64url');
let total=0;
const check=async(name,fn)=>{await fn();total++;console.log('PASS '+name);};
function expectError(result,name){
 assert.ok(result.execResult.exceptionError,'应当在 EVM 中回滚');
 if(name){const error=kilnAbi.parseError(bytesToHex(result.execResult.returnValue));assert.equal(error?.name,name);}
}
async function fresh(chainId=11155111){
 const vm=await createVM({common:createCustomCommon({chainId},Mainnet,{hardfork:Hardfork.Shanghai})});
 for(const address of [maker,other])await vm.stateManager.putAccount(createAddressFromString(address),new Account(0n,10n**20n));
 const execute=async(to,data,{from=maker,value=0n,isStatic=false}={})=>vm.evm.runCall({caller:createAddressFromString(from),...(to?{to:createAddressFromString(to)}:{}),data:hexToBytes(data),gasLimit:30_000_000n,value,isStatic});
 const deploy=async(bytecode)=>{
  const result=await execute(null,bytecode);assert.equal(result.execResult.exceptionError,undefined,result.execResult.exceptionError?.error);return result.createdAddress.toString();
 };
 const kiln=await deploy(artifact.bytecode);
 await vm.stateManager.putCode(createAddressFromString(coreAddress),hexToBytes('0x'+mockBuild.evm.deployedBytecode.object));
 const call=(method,args=[],options={})=>execute(kiln,kilnAbi.encodeFunctionData(method,args),options);
 const read=async(method,args=[])=>{const result=await call(method,args,{isStatic:true});assert.equal(result.execResult.exceptionError,undefined,method+' read failed');return kilnAbi.decodeFunctionResult(method,bytesToHex(result.execResult.returnValue));};
 const configure=async({impl=implementation,digest=layout,frontier=100n,work=420n,hash=dataHash,malformed=0}={})=>{
  const result=await execute(coreAddress,mockAbi.encodeFunctionData('configure',[impl,digest,frontier,work,hash,malformed]));assert.equal(result.execResult.exceptionError,undefined);
 };
 await configure();
 const mint=async({design=fixture,round=40n,work=420n,from=maker}={})=>{
  const result=await call('mint',[design,round,work],{from});assert.equal(result.execResult.exceptionError,undefined,bytesToHex(result.execResult.returnValue));return {id:kilnAbi.decodeFunctionResult('mint',bytesToHex(result.execResult.returnValue))[0],result};
 };
 return {vm,kiln,execute,deploy,call,read,configure,mint};
}
async function tokenMetadata(context,id){
 const [uri]=await context.read('tokenURI',[id]);assert.ok(uri.startsWith('data:application/json;base64,'));
 const json=JSON.parse(Buffer.from(uri.split(',')[1],'base64').toString());
 assert.ok(json.image.startsWith('data:image/svg+xml;base64,'));
 const svg=Buffer.from(json.image.split(',')[1],'base64').toString();
 return {uri,json,svg};
}

await check('固定编译器及 OZ 生成可部署代码，运行时哈希与实际 EVM 一致',async()=>{
 const context=await fresh();
 assert.ok(artifact.compiler.startsWith('0.8.30+'));assert.equal(artifact.openzeppelinVersion,'5.4.0');assert.ok((artifact.deployedBytecode.length-2)/2<=24576);
 const code=await context.vm.stateManager.getCode(createAddressFromString(context.kiln));assert.equal(keccak256(code),artifact.runtimeHash);
 const vm=await createVM({common:createCustomCommon({chainId:1},Mainnet,{hardfork:Hardfork.Shanghai})});
 await vm.stateManager.putAccount(createAddressFromString(maker),new Account(0n,10n**20n));
 expectError(await vm.evm.runCall({caller:createAddressFromString(maker),data:hexToBytes(artifact.bytecode),gasLimit:30_000_000n}),'WrongChain');
});

await check('ERC721/metadata/ERC165 标准接口与不存在的 token 行为正确',async()=>{
 const context=await fresh();
 assert.equal((await context.read('name'))[0],'Wheel & Clay');assert.equal((await context.read('symbol'))[0],'WCLAY');
 for(const id of ['0x80ac58cd','0x5b5e139f','0x01ffc9a7'])assert.equal((await context.read('supportsInterface',[id]))[0],true);
 assert.equal((await context.read('supportsInterface',['0xffffffff']))[0],false);
 for(const method of ['ownerOf','piece','tokenURI'])expectError(await context.call(method,[1n]),'ERC721NonexistentToken');
 assert.equal((await context.read('core'))[0].toLowerCase(),coreAddress);
});

await check('真实执行 mint 保存完整设计和认证累计值差额，并发出 PieceFired',async()=>{
 const context=await fresh(),{id,result}=await context.mint();assert.equal(id,1n);
 const p=await context.read('piece',[id]);
 assert.deepEqual([...p].map(x=>typeof x==='string'?x.toLowerCase():x),[maker,40n,420n,dataHash,keccak256(fixture),implementation,1n,'0x'+fixture.toString('hex')]);
 assert.equal((await context.read('ownerOf',[id]))[0].toLowerCase(),maker);assert.equal((await context.read('balanceOf',[maker]))[0],1n);
 const event=result.execResult.logs.map(([,topics,data])=>kilnAbi.parseLog({topics:topics.map(bytesToHex),data:bytesToHex(data)})).find(log=>log.name==='PieceFired');
 assert.deepEqual([...event.args],[1n,(await context.read('ownerOf',[1n]))[0],40n,420n,keccak256(fixture)]);
 assert.deepEqual([...(await context.read('roundSource',[40n]))],[420n,dataHash]);
});

await check('270 字节编码的长度、魔数、版本、所有枚举、光泽和保留位均在 EVM 校验',async()=>{
 const context=await fresh();
 for(const malformed of [fixture.subarray(0,269),Buffer.concat([fixture,Buffer.from([0])])])expectError(await context.call('mint',[malformed,40n,420n]),'InvalidDesign');
 for(const [offset,value] of [[0,0],[1,0],[2,2],[3,3],[4,16],[5,4],[6,3],[7,4],[10,1],[11,1]]){
  const malformed=Buffer.from(fixture);malformed[offset]=value;expectError(await context.call('mint',[malformed,40n,420n]),'InvalidDesign');
 }
 const badFinish=Buffer.from(fixture);badFinish.writeUInt16BE(1001,8);expectError(await context.call('mint',[badFinish,40n,420n]),'InvalidDesign');
 assert.equal((await context.read('totalMinted'))[0],0n);
});

await check('全部 129 个半径都校验，边界 2400/12300 与光泽 0/1000 可用',async()=>{
 const context=await fresh();
 for(let index=0;index<129;index++){
  const malformed=Buffer.from(fixture);malformed.writeUInt16BE(index%2?2399:12301,12+index*2);expectError(await context.call('mint',[malformed,40n,420n]),'InvalidDesign');
 }
 for(const finish of [0,1000]){
  const design=Buffer.from(fixture);design.writeUInt16BE(finish,8);for(let index=0;index<129;index++)design.writeUInt16BE(index%2?2400:12300,12+index*2);
  await context.mint({design});
 }
 assert.equal((await context.read('totalMinted'))[0],2n);
});

await check('轮次零、未知轮次、未完整认证及 expectedWork 不一致均拒绝',async()=>{
 const context=await fresh();
 expectError(await context.call('mint',[fixture,0n,420n]),'InvalidRound');expectError(await context.call('mint',[fixture,101n,420n]));
 expectError(await context.call('mint',[fixture,40n,419n]),'WorkChanged');
 await context.configure({malformed:1});expectError(await context.call('mint',[fixture,40n,420n]),'UncertifiedRound');
 assert.equal((await context.read('totalMinted'))[0],0n);
});

await check('每次 mint 验证 Core 实现和存储布局，升级后停止新铸造',async()=>{
 const context=await fresh();await context.mint();
 await context.configure({impl:other});expectError(await context.call('mint',[fixture,41n,420n]),'CoreIdentityChanged');
 await context.configure({digest:'0x'+'22'.repeat(32)});expectError(await context.call('mint',[fixture,41n,420n]),'CoreIdentityChanged');
 await context.configure();await context.mint({round:41n});assert.equal((await context.read('totalMinted'))[0],2n);
});

await check('错误累计端点、缺失 checkpoint、轮次错配与空 dataHash 拒绝',async()=>{
 const context=await fresh();
 for(const malformed of [2,3,4,5]){await context.configure({malformed});expectError(await context.call('mint',[fixture,40n,420n]),'MalformedRoundSource');}
 await context.configure({hash:'0x'+'00'.repeat(32)});expectError(await context.call('mint',[fixture,40n,420n]),'MalformedRoundSource');
 await context.configure({work:0n,malformed:6});expectError(await context.call('mint',[fixture,40n,0n]),'MalformedRoundSource');
 assert.equal((await context.read('totalMinted'))[0],0n);
});

await check('已认证零工作量可以铸造，保存零 hash，并生成零能量静纹',async()=>{
 const context=await fresh();await context.configure({work:0n});const {id}=await context.mint({work:0n});
 const p=await context.read('piece',[id]);assert.equal(p.work,0n);assert.equal(p.dataHash,'0x'+'00'.repeat(32));
 const {json,svg}=await tokenMetadata(context,id),attrs=Object.fromEntries(json.attributes.map(a=>[a.trait_type,a.value]));
 assert.equal(attrs['Kiln energy bps'],0);assert.equal(attrs['Kiln seed32'],40);assert.ok(json.description.includes('Zero work does not establish animal sleep'));assert.ok(!/<animate|<script/.test(svg));
});

await check('同 maker/design/round 防重在转让后继续有效，其他作者或轮次可铸造',async()=>{
 const context=await fresh();await context.mint();expectError(await context.call('mint',[fixture,40n,420n]),'AlreadyFired');
 const transfer=await context.call('transferFrom',[maker,other,1n]);assert.equal(transfer.execResult.exceptionError,undefined);
 expectError(await context.call('mint',[fixture,40n,420n]),'AlreadyFired');
 await context.mint({from:other});await context.mint({round:41n});const changed=Buffer.from(fixture);changed[4]=2;await context.mint({design:changed});
 assert.equal((await context.read('totalMinted'))[0],4n);
});

await check('标准授权转让实际执行，maker、设计及 tokenURI 不因所有权或 Core 变化而改变',async()=>{
 const context=await fresh();await context.mint();const beforePiece=await context.read('piece',[1n]),before=await tokenMetadata(context,1n);
 expectError(await context.call('transferFrom',[maker,other,1n],{from:other}),'ERC721InsufficientApproval');
 assert.equal((await context.call('approve',[other,1n])).execResult.exceptionError,undefined);
 assert.equal((await context.call('transferFrom',[maker,other,1n],{from:other})).execResult.exceptionError,undefined);
 assert.equal((await context.read('ownerOf',[1n]))[0].toLowerCase(),other);assert.equal((await context.read('balanceOf',[maker]))[0],0n);
 assert.deepEqual([...(await context.read('piece',[1n]))],[...beforePiece]);
 await context.configure({impl:other,work:0n});assert.equal((await tokenMetadata(context,1n)).uri,before.uri);
});

await check('安全接收回滚不消耗 token ID，接收回调不能重复铸造同一件',async()=>{
 const context=await fresh(),builds=output.contracts['contracts/test/ReceiverFixtures.sol'];
 const rejecting=await context.deploy('0x'+builds.RejectingReceiver.evm.bytecode.object),rejectAbi=new Interface(builds.RejectingReceiver.abi);
 expectError(await context.execute(rejecting,rejectAbi.encodeFunctionData('fire',[context.kiln,fixture,40n,420n])),'ERC721InvalidReceiver');
 assert.equal((await context.read('totalMinted'))[0],0n);
 const key=keccak256(AbiCoder.defaultAbiCoder().encode(['address','bytes32','uint64'],[rejecting,keccak256(fixture),40n]));assert.equal((await context.read('fired',[key]))[0],false);
 const reentering=await context.deploy('0x'+builds.ReenteringReceiver.evm.bytecode.object),reenterAbi=new Interface(builds.ReenteringReceiver.abi);
 const result=await context.execute(reentering,reenterAbi.encodeFunctionData('fire',[context.kiln,fixture,40n,420n]));assert.equal(result.execResult.exceptionError,undefined);
 const rejected=await context.execute(reentering,reenterAbi.encodeFunctionData('duplicateRejected'));assert.equal(reenterAbi.decodeFunctionResult('duplicateRejected',bytesToHex(rejected.execResult.returnValue))[0],true);
 assert.equal((await context.read('ownerOf',[1n]))[0].toLowerCase(),reentering);assert.equal((await context.read('totalMinted'))[0],1n);
});

await check('mint 非 payable，发送 ETH 会回滚，零 value 不收取铸造费',async()=>{
 const context=await fresh();expectError(await context.call('mint',[fixture,40n,420n],{value:1n}));
 assert.equal((await context.read('totalMinted'))[0],0n);await context.mint();
 assert.equal((await context.vm.stateManager.getAccount(createAddressFromString(context.kiln))).balance,0n);
});

await check('tokenURI 可解析为 JSON/SVG，完整编码与所有 129 个真实半径一致',async()=>{
 const context=await fresh();await context.mint();const {json,svg}=await tokenMetadata(context,1n);
 assert.equal(json.name,'Wheel & Clay #1');assert.equal(json.external_url,'https://wheel-and-clay.shop/?nft=1');assert.equal(json.properties.design_encoding,'WC-v1-270');assert.equal(json.properties.design_hash,keccak256(fixture));assert.deepEqual(Buffer.from(json.properties.design_base64,'base64'),fixture);
 assert.equal(json.properties.source_core,coreAddress);assert.equal(json.properties.source_implementation,implementation);assert.equal(json.properties.maker,maker);assert.equal(json.properties.source_chain_id,11155111);
 const parsed=spawnSync('python3',['-c','import sys,xml.etree.ElementTree as E; root=E.fromstring(sys.stdin.read()); assert root.tag=="{http://www.w3.org/2000/svg}svg"; print("valid SVG")'],{input:svg,encoding:'utf8'});assert.equal(parsed.status,0,parsed.stderr);
 const path=svg.match(/<clipPath id="pot"><path d="([^"]+)"/)[1],points=[...path.matchAll(/[ML] (\d+) (\d+)/g)].map(match=>[Number(match[1]),Number(match[2])]);assert.equal(points.length,258);
 for(let index=0;index<129;index++){
  const radius=fixture.readUInt16BE(12+index*2),y=37000-Math.floor(index*26500/128);
  assert.deepEqual(points[index],[18000-radius,y]);assert.deepEqual(points[257-index],[18000+radius,y]);
 }
 assert.ok(svg.includes('fill="#176f81"'));assert.ok(svg.includes('2D profile preview'));
});

await check('窑变 v1 seed32 和能量映射使用 uint32 截断与整数饱和规则',async()=>{
 const context=await fresh();
 const round=2n**40n+40n;
 for(const work of [1n,499n,500n,10000n]){
  await context.configure({frontier:round,work});const changed=Buffer.from(fixture);changed[4]=Number(work%16n);changed.writeUInt16BE(Number(work%1001n),8);
  const {id}=await context.mint({design:changed,round,work}),{json}=await tokenMetadata(context,id),attrs=Object.fromEntries(json.attributes.map(a=>[a.trait_type,a.value]));
  const seed=Number((BigInt('0xaabbccdd')^(round&0xffffffffn)^(work&0xffffffffn))&0xffffffffn);
  assert.equal(attrs['Kiln seed32'],seed);assert.equal(attrs['Kiln energy bps'],Number(work*20n>10000n?10000n:work*20n));
 }
});

console.log(`RESULT ${total}/${total}`);
