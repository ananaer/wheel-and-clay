import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const contractRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const projectRoot=resolve(contractRoot,'..');
export const toolsDirectory=process.env.KILN_TOOLS_DIR||'/private/tmp/wheel-clay-contract-tools';
export const toolRequire=createRequire(join(toolsDirectory,'package.json'));

export function compileContracts({writeArtifact=true}={}){
 const solc=toolRequire('solc'),{keccak256}=toolRequire('ethers');
 if(!solc.version().startsWith('0.8.30+'))throw new Error('需要固定的 solc 0.8.30');
 const sources={},sourceHashes={};
 function readSource(name){
  const path=resolve(projectRoot,name);
  if(!path.startsWith(contractRoot+'/'))throw new Error('拒绝合约目录以外的导入: '+name);
  const content=readFileSync(path,'utf8');sourceHashes[name]=createHash('sha256').update(content).digest('hex');
  return content;
 }
 for(const folder of ['src','test'])for(const filename of readdirSync(join(contractRoot,folder)).filter(name=>name.endsWith('.sol'))){
  const name=`contracts/${folder}/${filename}`;sources[name]={content:readSource(name)};
 }
 const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers']}}};
 const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import(name){try{return {contents:readSource(name)};}catch(error){return {error:error.message};}}}));
 const errors=(output.errors||[]).filter(item=>item.severity==='error');
 if(errors.length)throw new Error(errors.map(item=>item.formattedMessage).join('\n'));
 for(const warning of (output.errors||[]).filter(item=>item.severity!=='error'))console.warn(warning.formattedMessage);
 const built=output.contracts['contracts/src/WheelAndClay.sol'].WheelAndClay;
 const deployedBytecode='0x'+built.evm.deployedBytecode.object;
 if((deployedBytecode.length-2)/2>24576)throw new Error('运行时代码超过 EIP-170 上限');
 const artifact={contractName:'WheelAndClay',sourceName:'contracts/src/WheelAndClay.sol',compiler:solc.version(),openzeppelinVersion:'5.4.0',settings:{optimizer:settings.optimizer,viaIR:settings.viaIR,evmVersion:settings.evmVersion},abi:built.abi,bytecode:'0x'+built.evm.bytecode.object,deployedBytecode,methodIdentifiers:built.evm.methodIdentifiers,runtimeHash:keccak256(deployedBytecode),sourceHashes};
 if(writeArtifact){mkdirSync(join(contractRoot,'artifacts'),{recursive:true});writeFileSync(join(contractRoot,'artifacts/WheelAndClay.json'),JSON.stringify(artifact,null,2)+'\n');}
 return {output,artifact};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {artifact}=compileContracts();
 console.log(JSON.stringify({artifact:relative(projectRoot,join(contractRoot,'artifacts/WheelAndClay.json')),compiler:artifact.compiler,runtimeBytes:(artifact.deployedBytecode.length-2)/2,runtimeHash:artifact.runtimeHash},null,2));
}
