import { off } from 'process';
import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
    
  // Approach:
  // 1. Use fixed-size fields where possible (e.g., 8 bytes for amounts, timestamps)
  // 2. Use length-prefixed strings for variable-length data (id, signatures, public keys)
  // 3. Use compact representations for counts (e.g., 1 byte for number of inputs/outputs if < 256)

  const idBuffer = encodeString(transaction.id);

  const inputsCountBuffer = encodeSmallNumber(transaction.inputs.length);
  const inputsBuffer: Buffer[] = [];
  for (const input of transaction.inputs) {
    inputsBuffer.push(encodeTransactionInput(input));
  }

  const outputsCountBuffer = encodeSmallNumber(transaction.outputs.length);
  const outputsBuffer: Buffer[] = [];
  for (const output of transaction.outputs) {
    outputsBuffer.push(encodeTransactionOutput(output));
  }

  const timestampBuffer = encodeNumber(transaction.timestamp);

  return Buffer.concat([idBuffer, inputsCountBuffer, ...inputsBuffer, outputsCountBuffer, ...outputsBuffer, timestampBuffer]);
}

// Encode string
function encodeString(str: string): Buffer {
  const buf = Buffer.from(str, 'utf-8');
  return Buffer.concat([Buffer.from([buf.length]), buf]); // prefijo con la longitud + contenido
}

// Codificación de número en 8 bytes
function encodeNumber(num: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(num)); 
  return buf;
}

// Codificación de número en 1 byte
function encodeSmallNumber(num: number): Buffer {
  const buf = Buffer.alloc(1);
  buf.writeUInt8((num)); 
  return buf;
}

// Codificación de TransactionInput
function encodeTransactionInput(input: TransactionInput): Buffer {
  const txIdBuf = encodeString(input.utxoId.txId);
  const outputIndexBuf = encodeNumber(input.utxoId.outputIndex);
  const ownerBuf = encodeString(input.owner);
  const signatureBuf = encodeString(input.signature);
  return Buffer.concat([txIdBuf, outputIndexBuf, ownerBuf, signatureBuf]);
}

// Codificación de TransactionOutput
function encodeTransactionOutput(output: TransactionOutput): Buffer {
  const amountBuf = encodeNumber(output.amount);
  const recipientBuf = encodeString(output.recipient);
  return Buffer.concat([amountBuf, recipientBuf]);
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */

export function decodeTransaction(buffer: Buffer): Transaction {
  let offset = 0;

  const resultIdDecode = decodeString(buffer, offset);
  const id = resultIdDecode.value;
  offset = resultIdDecode.newOffset;

  const inputs: TransactionInput[] = [];
  const resultInputsCountDecode = decodeSmallNumber(buffer, offset);
  const inputsCount = resultInputsCountDecode.value;
  offset = resultInputsCountDecode.newOffset;

  for (let i = 0; i < inputsCount; i++) {
    const resultInputDecode = decodeTransactionInput(buffer, offset);
    inputs.push(resultInputDecode.input);
    offset = resultInputDecode.newOffset;
  }

  const outputs: TransactionOutput[] = [];
  const resultOutputsCountDecode = decodeSmallNumber(buffer, offset);
  const outputsCount = resultOutputsCountDecode.value;
  offset = resultOutputsCountDecode.newOffset;

  for (let i = 0; i < outputsCount; i++) {
    const resultOutputDecode = decodeTransactionOutput(buffer, offset);
    outputs.push(resultOutputDecode.output);
    offset = resultOutputDecode.newOffset;
  }

  const resultTimestampDecode = decodeNumber(buffer, offset);
  const timestamp = resultTimestampDecode.value;

  return { id, inputs, outputs, timestamp };
}

// Decodificar string 
function decodeString(buf: Buffer, offset: number): { value: string; newOffset: number } {
  const length = buf.readUInt8(offset); // lee longitud
  const start = offset + 1;
  const end = start + length;

  if (end > buf.length) {
    throw new Error(`Buffer too small to read string at offset ${offset}`);
  }

  const value = buf.toString('utf-8', start, end);
  return { value, newOffset: end };
}

// Decodificar número (8 bytes)
function decodeNumber(buf: Buffer, offset: number): { value: number; newOffset: number } {
  if (offset + 8 > buf.length) {
    throw new Error(`Buffer too small to read 8-byte number at offset ${offset}`);
  }

  const value = Number(buf.readBigUInt64BE(offset));
  return { value, newOffset: offset + 8 };
}

// Decodificar número (1 byte)
function decodeSmallNumber(buf: Buffer, offset: number): { value: number; newOffset: number } {
  if (offset + 1 > buf.length) {
    throw new Error(`Buffer too small to read 1-byte number at offset ${offset}`);
  }
  
  const value = buf.readUInt8(offset);
  return { value, newOffset: offset + 1 };
}

// Decodificar TransactionInput
function decodeTransactionInput(buf: Buffer, offset: number): { input: TransactionInput; newOffset: number } {
  let nextOffset = offset;
  
  const resultTxIdDecode = decodeString(buf, nextOffset);
  const txId = resultTxIdDecode.value;
  nextOffset = resultTxIdDecode.newOffset;

  const resultOutputIndexDecode = decodeNumber(buf, nextOffset);
  const outputIndex = resultOutputIndexDecode.value;
  nextOffset = resultOutputIndexDecode.newOffset;

  const resultOwnerDecode = decodeString(buf, nextOffset);
  const owner = resultOwnerDecode.value;
  nextOffset = resultOwnerDecode.newOffset;

  const resultSignatureDecode = decodeString(buf, nextOffset);
  const signature = resultSignatureDecode.value;
  nextOffset = resultSignatureDecode.newOffset;

  return {
    input: {
      utxoId: { txId, outputIndex },
      owner,
      signature
    },
    newOffset: nextOffset
  };
}

// Decodificar TransactionOutput
function decodeTransactionOutput(buf: Buffer, offset: number): { output: TransactionOutput; newOffset: number } {
  let nextOffset = offset;

  const resultAmountDecode = decodeNumber(buf, nextOffset);
  const amount = resultAmountDecode.value;
  nextOffset = resultAmountDecode.newOffset;

  const resultRecipientDecode = decodeString(buf, nextOffset);
  const recipient = resultRecipientDecode.value;
  nextOffset = resultRecipientDecode.newOffset;

  return {
    output: { amount, recipient },
    newOffset: nextOffset
  };
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