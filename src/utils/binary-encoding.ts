import { Transaction, TransactionInput, TransactionOutput } from '../types';

const timestamps = 8;
const inputAmount = 1;
const outputAmount = 1;	
const outputIndex = 4;
const amounts = 8;


function copyIntoBuffer(buf:Buffer, offset:number, str:string, encoding:string): number{
	let bytes;
	if(encoding == 'utf-8'){
		bytes = Buffer.from(str, 'utf-8');
	}
	else{
		bytes = Buffer.from(str, 'hex');
	}
	buf.writeUInt16BE(bytes.length, offset);
	offset += 2;
	bytes.copy(buf, offset);
	offset += bytes.length;
	return offset;
}

function readFromBuffer(buf:Buffer, offset:number, encoding:string) : {value:string, offset:number}{
	const length = buf.readUInt16BE(offset);
	offset += 2;
	let value;
	if(encoding == 'utf-8'){
		value = buf.toString('utf-8', offset, offset + length);
	}
	else{
		value = buf.toString('hex', offset, offset + length);
	}
	offset += length;

	return {
		value: value,
		offset: offset
	};
}


function calculateBufferSize(transaction: Transaction): number{

	let transactionId = Buffer.from(transaction.id, 'utf-8').length + 2;

	let totalsize = 0;

	totalsize += timestamps;
	totalsize += inputAmount;
	totalsize += outputAmount;
	totalsize += transactionId;

	for(const input of transaction.inputs){
		totalsize += Buffer.from(input.utxoId.txId, 'utf-8').length + 2;
		totalsize += outputIndex;
		totalsize += Buffer.from(input.owner, 'utf-8').length + 2;
		totalsize += Buffer.from(input.signature, 'utf-8').length + 2;
	}

	for(const output of transaction.outputs){
		totalsize += amounts;
		totalsize += Buffer.from(output.recipient, 'utf-8').length + 2;
	}
	return totalsize;
}


/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {

	let totalsize = calculateBufferSize(transaction);
	const buf = Buffer.alloc(totalsize);

	let offset = 0;

	buf.writeBigUInt64BE(BigInt(transaction.timestamp), offset);
	offset += timestamps;

	buf.writeUInt8(transaction.inputs.length, offset);
	offset += inputAmount;

	buf.writeUInt8(transaction.outputs.length, offset);
	offset += outputAmount;

	offset = copyIntoBuffer(buf, offset, transaction.id, 'utf-8');

	for(const input of transaction.inputs){
		offset = copyIntoBuffer(buf, offset, input.utxoId.txId, 'utf-8');

		buf.writeUInt32BE(input.utxoId.outputIndex, offset);
		offset += outputIndex;

		offset = copyIntoBuffer(buf, offset, input.owner, 'utf-8');

		offset = copyIntoBuffer(buf, offset, input.signature, 'utf-8');
	}

	for(const output of transaction.outputs){
		buf.writeBigUInt64BE(BigInt(output.amount), offset);
		offset += 8;

		offset = copyIntoBuffer(buf, offset, output.recipient, 'utf-8');
	}


	return buf;
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {

	let offset = 0;

	const timestamp = Number(buffer.readBigUInt64BE(offset));
	offset += timestamps;

	const inputCount = buffer.readUInt8(offset);
	offset += inputAmount;

	const outputCount = buffer.readUInt8(offset);
	offset += outputAmount;

	const idResult = readFromBuffer(buffer, offset, 'utf-8');
	const id = idResult.value;
	offset = idResult.offset;

	const inputs: TransactionInput[] = [];
	for(let i = 0; i < inputCount; i++){

		const trInput: TransactionInput = {
			utxoId: { txId: '', outputIndex: 0 },
			owner: '',
			signature: ''
		};

		const txIdResult = readFromBuffer(buffer, offset, 'utf-8');
		trInput.utxoId.txId = txIdResult.value;
		offset = txIdResult.offset;

		const outputIndexResult = buffer.readUInt32BE(offset);
		trInput.utxoId.outputIndex = outputIndexResult;
		offset += 4;

		const ownerResult = readFromBuffer(buffer, offset, 'utf-8');
		trInput.owner = ownerResult.value;
		offset = ownerResult.offset;

		const signatureResult = readFromBuffer(buffer, offset, 'utf-8');
		trInput.signature = signatureResult.value;
		offset = signatureResult.offset;

		inputs.push(trInput);
	}

	const outputs: TransactionOutput[] = [];
	for(let i = 0; i < outputCount; i++){
		const trOutput: TransactionOutput = {
			amount: 0,
			recipient: ''
		};

		const amount = Number(buffer.readBigUInt64BE(offset));
		trOutput.amount = amount;
		offset += 8;

		const recipientResult = readFromBuffer(buffer, offset, 'utf-8');
		trOutput.recipient = recipientResult.value;
		offset = recipientResult.offset;

		outputs.push(trOutput);
	}

	const returnTr: Transaction = {
		outputs: outputs,
		inputs: inputs,
		timestamp: timestamp,
		id: id
	};


	return returnTr;
}

/**
 * Compare encoding efficiency between JSON and binary representations
 * @param {Transaction} transaction - The transaction to analyze
 * @returns {object} Size comparison and savings information
 */
export function getEncodingEfficiency(transaction: Transaction): {
	jsonSize: number;
	binarySize: number;
	savings: string;
} {
	const jsonSize = Buffer.from(JSON.stringify(transaction)).length;
	try {
		const binarySize = encodeTransaction(transaction).length;
		const savingsPercent = (((jsonSize - binarySize) / jsonSize) * 100).toFixed(1);
		return {
			jsonSize,
			binarySize,
			savings: `${savingsPercent}%`
		};
	} catch {
		return {
			jsonSize,
			binarySize: -1,
			savings: 'Not implemented'
		};
	}
}
