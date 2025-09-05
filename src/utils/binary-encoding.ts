import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */

// === Helpers compactos 
const u8 = (n: number) => { const b = Buffer.alloc(1); b.writeUInt8(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u64 = (n: number | bigint) => {
  const v = BigInt(n);
  const b = Buffer.alloc(8);
  b.writeUInt32BE(Number((v >> 32n) & 0xffffffffn), 0);
  b.writeUInt32BE(Number(v & 0xffffffffn), 4);
  return b;
};
const strW = (s: string) => { const bs = Buffer.from(s, 'utf8'); return Buffer.concat([u32(bs.length), bs]); };

function u8R(buf: Buffer, o: number) { return [buf.readUInt8(o), o + 1] as const; }
function u16R(buf: Buffer, o: number) { return [buf.readUInt16BE(o), o + 2] as const; }
function u32R(buf: Buffer, o: number) { return [buf.readUInt32BE(o), o + 4] as const; }
function u64R(buf: Buffer, o: number) {
  const hi = BigInt(buf.readUInt32BE(o)), lo = BigInt(buf.readUInt32BE(o + 4));
  return [Number((hi << 32n) + lo), o + 8] as const;
}
function strR(buf: Buffer, o: number) {
  const [len, o2] = u32R(buf, o);
  return [buf.toString('utf8', o2, o2 + len), o2 + len] as const;
}


export function encodeTransaction(transaction: Transaction): Buffer {
  const parts: Buffer[] = [];

  // id + timestamp
  parts.push(strW(transaction.id), u64(transaction.timestamp));

  // inputs
  const ins = transaction.inputs ?? [];
  parts.push(u8(ins.length));
  for (const i of ins) {
    parts.push(
      strW(i.utxoId.txId),
      u32(i.utxoId.outputIndex),
      strW(i.owner),
      strW(i.signature),
    );
  }

  // outputs
  const outs = transaction.outputs ?? [];
  parts.push(u8(outs.length));
  for (const o of outs) {
    parts.push(u64(o.amount), strW(o.recipient));
  }

  return Buffer.concat(parts);
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {
  let o = 0;

  let s;[s, o] = strR(buffer, o);           
  // id
  const id = s;

  let t;[t, o] = u64R(buffer, o);           
  // timestamp
  const timestamp = t;

  let c;[c, o] = u8R(buffer, o);            
  // inputs count
  const inputs = Array.from({ length: c }, () => {
    let txId;[txId, o] = strR(buffer, o);
    let outIdx;[outIdx, o] = u32R(buffer, o);
    let owner;[owner, o] = strR(buffer, o);
    let sig;[sig, o] = strR(buffer, o);
    return { utxoId: { txId, outputIndex: outIdx }, owner, signature: sig };
  });

  [c, o] = u8R(buffer, o);                    
  // outputs count
  const outputs = Array.from({ length: c }, () => {
    let amount;[amount, o] = u64R(buffer, o);
    let recipient;[recipient, o] = strR(buffer, o);
    return { amount, recipient };
  });

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
