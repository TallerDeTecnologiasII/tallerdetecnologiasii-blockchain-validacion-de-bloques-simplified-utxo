import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
  const tmp = Buffer.alloc(10000);
  const view = new DataView(tmp.buffer);
  let offset = 0;

  offset = writeString(view, offset, transaction.id);
  offset = writeUInt64(view, offset, transaction.timestamp);

  offset = writeInputs(view, offset, transaction.inputs || []);
  offset = writeOutputs(view, offset, transaction.outputs || []);

  return Buffer.from(tmp.buffer.slice(0, offset));
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  let id: string;
  [id, offset] = readString(view, offset);

  const [timestamp, newOffset] = readUInt64(view, offset);
  offset = newOffset;

  const [inputs, offsetAfterInputs] = readInputs(view, offset);
  offset = offsetAfterInputs;

  const [outputs, offsetAfterOutputs] = readOutputs(view, offset);
  offset = offsetAfterOutputs;

  return { id, inputs, outputs, timestamp };
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

/* --------------------------------- Helpers -------------------------------- */

function writeUInt64(view: DataView, offset: number, value: number): number {
  view.setBigUint64(offset, BigInt(value), true);
  return offset + 8;
}

function writeString(view: DataView, offset: number, str: string): number {
  const bytes = Buffer.from(str, 'utf8');
  view.setUint16(offset, bytes.length, true);
  offset += 2;
  new Uint8Array(view.buffer, offset, bytes.length).set(bytes);
  return offset + bytes.length;
}

function writeInputs(view: DataView, offset: number, inputs: TransactionInput[]): number {
  view.setUint8(offset, inputs.length);
  offset += 1;
  for (const input of inputs) {
    offset = writeString(view, offset, input.utxoId.txId);
    view.setUint32(offset, input.utxoId.outputIndex, true);
    offset += 4;
    offset = writeString(view, offset, input.owner);
    offset = writeString(view, offset, input.signature);
  }
  return offset;
}

function writeOutputs(view: DataView, offset: number, outputs: TransactionOutput[]): number {
  view.setUint8(offset, outputs.length);
  offset += 1;
  for (const output of outputs) {
    offset = writeUInt64(view, offset, output.amount);
    offset = writeString(view, offset, output.recipient);
  }
  return offset;
}

function readUInt64(view: DataView, offset: number): [number, number] {
  const value = Number(view.getBigUint64(offset, true));
  return [value, offset + 8];
}

function readString(view: DataView, offset: number): [string, number] {
  const len = view.getUint16(offset, true);
  offset += 2;
  const bytes = new Uint8Array(view.buffer, offset, len);
  offset += len;
  return [Buffer.from(bytes).toString('utf8'), offset];
}

function readInputs(view: DataView, offset: number): [TransactionInput[], number] {
  const inputs: TransactionInput[] = [];
  const count = view.getUint8(offset);
  offset += 1;
  for (let i = 0; i < count; i++) {
    let txId: string, owner: string, signature: string;
    [txId, offset] = readString(view, offset);
    const outputIndex = view.getUint32(offset, true);
    offset += 4;
    [owner, offset] = readString(view, offset);
    [signature, offset] = readString(view, offset);
    inputs.push({ utxoId: { txId, outputIndex }, owner, signature });
  }
  return [inputs, offset];
}

function readOutputs(view: DataView, offset: number): [TransactionOutput[], number] {
  const outputs: TransactionOutput[] = [];
  const count = view.getUint8(offset);
  offset += 1;
  for (let j = 0; j < count; j++) {
    let amount: number, recipient: string;
    [amount, offset] = readUInt64(view, offset);
    [recipient, offset] = readString(view, offset);
    outputs.push({ amount, recipient });
  }
  return [outputs, offset];
}
