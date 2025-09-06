  import { Transaction, TransactionInput, TransactionOutput, UtxoId } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
  // BONUS CHALLENGE: Implement binary encoding for transactions
  // This should create a compact binary representation instead of JSON

  const buffers: Buffer[] = [];

  // Codificar la transacción usando las función auxiliares
  buffers.push(encodeString(transaction.id)); 

  const totalInputAmount = transaction.inputs.length;
  buffers.push(encodeUInt8(totalInputAmount));
  for (const input of transaction.inputs) {
    buffers.push(encodeTransactionInput(input));
  }

  const totalOutputAmount = transaction.outputs.length;
  buffers.push(encodeUInt8(totalOutputAmount));
  for (const output of transaction.outputs) {
    buffers.push(encodeTransactionOutput(output));
  }

  buffers.push(encodeNumber8Bytes(transaction.timestamp));
  return Buffer.concat(buffers);
}

  // Codificar numeros (8 bytes y 2 bytes)
  function encodeNumber8Bytes(value: number): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeDoubleBE(value);
    return buffer;
  }

  function encodeNumber2Bytes(value: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(value);
    return buffer;
  }

  function encodeUInt8(value: number): Buffer {
  const buffer = Buffer.alloc(1);
  buffer.writeUInt8(value);
  return buffer;
}

  // Codificar strings cortos
  function encodeString(str: string): Buffer {
    const strBuffer = Buffer.from(str, 'utf8');
    
    // Excepción si la longitud de la cadena demasiado larga
    if (strBuffer.length > 255) {
      throw new Error(`String too long for encoding: ${str.length} bytes`);
    }
    const lengthBuffer = encodeUInt8(strBuffer.length); 
    return Buffer.concat([lengthBuffer, strBuffer]);
  }

  // Codificar el UtxoId (txId + outputIndex)
  function encodeUtxoId(utxoId: UtxoId): Buffer {
    const buffers: Buffer[] = [];
    buffers.push(encodeString(utxoId.txId));
    buffers.push(encodeNumber2Bytes(utxoId.outputIndex));
    return Buffer.concat(buffers);
  }

  // Codificar los input de la transaccion (utxoId + owner + signature)
  function encodeTransactionInput(input: TransactionInput): Buffer {
    const buffers: Buffer[] = [];
    buffers.push(encodeUtxoId(input.utxoId));
    buffers.push(encodeString(input.owner));
    buffers.push(encodeString(input.signature));
    return Buffer.concat(buffers);
  }

  // Codificar los output de la transaccion (amount + recipient)
  function encodeTransactionOutput(output: TransactionOutput): Buffer {
    const buffers: Buffer[] = [];
    buffers.push(encodeNumber8Bytes(output.amount));  // number
    buffers.push(encodeString(output.recipient));     // string
    return Buffer.concat(buffers);
  }

  /**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {
  // BONUS CHALLENGE: Implement binary decoding for transactions
  // This should reconstruct a Transaction object from the binary representation

  //Decodificación de la transacción usando las funciones auxiliares
  let offset = 0;

  const idDecoded = decodeString(buffer, offset);
  offset = idDecoded.offset;

  const inputsCountDecoded = decodeUInt8(buffer, offset);
  offset = inputsCountDecoded.offset;

  const inputsDecoded: TransactionInput[] = [];
  for (let i = 0; i < inputsCountDecoded.value; i++) {
    const inputDecoded = decodeTransactionInput(buffer, offset);
    inputsDecoded.push(inputDecoded.value);
    offset = inputDecoded.offset;
  }

  const outputsCountDecoded = decodeUInt8(buffer, offset);
  offset = outputsCountDecoded.offset;

  const outputsDecoded: TransactionOutput[] = [];
  for (let i = 0; i < outputsCountDecoded.value; i++) {
    const outputDecoded = decodeTransactionOutput(buffer, offset);
    outputsDecoded.push(outputDecoded.value);
    offset = outputDecoded.offset;
  }

  const timestampDecoded = decodeNumber8Bytes(buffer, offset);
  offset = timestampDecoded.offset;
  
  const transaction: Transaction = {
    id: idDecoded.value,
    inputs: inputsDecoded,
    outputs: outputsDecoded,
    timestamp: timestampDecoded.value
  };
  return transaction;
}

// Decodificación de string
function decodeString(buffer: Buffer, offset: number): { value: string, offset: number } {
  const length = buffer.readUInt8(offset);
  offset += 1;
  const value = buffer.toString('utf8', offset, offset + length);
  return { value, offset: offset + length };
}

// Decodificación de numeros (8 bytes y 2 bytes)
function decodeNumber8Bytes(buffer: Buffer, offset: number): { value: number, offset: number } {
  const value = buffer.readDoubleBE(offset);
  return { value: Number(value), offset: offset + 8 };
}

function decodeNumber2Bytes(buffer: Buffer, offset: number): { value: number, offset: number } {
  const value = buffer.readUInt16BE(offset);
  return { value, offset: offset + 2 };
}

function decodeUInt8(buffer: Buffer, offset: number): { value: number, offset: number } {
  const value = buffer.readUInt8(offset);
  return { value, offset: offset + 1 };
}

// Decodificación del UtxoId
function decodeUtxoId(buffer: Buffer, offset: number): { value: UtxoId, offset: number } {
  const txIdResult = decodeString(buffer, offset);
  offset = txIdResult.offset;
  const outputIndexResult = decodeNumber2Bytes(buffer, offset);
  offset = outputIndexResult.offset;
  const utxoId: UtxoId = {
    txId: txIdResult.value,
    outputIndex: outputIndexResult.value
  };
  return { value: utxoId, offset };
}

// Decodificación de los input de la transacción
function decodeTransactionInput(buffer: Buffer, offset: number): { value: TransactionInput, offset: number } {
  const utxoIdResult = decodeUtxoId(buffer, offset);
  offset = utxoIdResult.offset;
  const ownerResult = decodeString(buffer, offset);
  offset = ownerResult.offset;
  const signatureResult = decodeString(buffer, offset);
  offset = signatureResult.offset;
  
  return { 
    value: {
      utxoId: utxoIdResult.value,
      owner: ownerResult.value,
      signature: signatureResult.value
    },
    offset 
  };
}

// Decodificación de los output de la transacción
function decodeTransactionOutput(buffer: Buffer, offset: number): { value: TransactionOutput, offset: number } {
  const amountResult = decodeNumber8Bytes(buffer, offset);
  offset = amountResult.offset;
  const recipientResult = decodeString(buffer, offset);
  offset = recipientResult.offset;
  const transactionOutput: TransactionOutput = {
    amount: amountResult.value,
    recipient: recipientResult.value
  };
  return { value: transactionOutput, offset };
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
