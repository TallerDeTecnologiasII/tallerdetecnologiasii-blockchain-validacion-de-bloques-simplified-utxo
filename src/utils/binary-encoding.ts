import { Transaction, TransactionInput, TransactionOutput } from '../types';
import {TransactionBuilder} from "../transaction-builder";


/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */


// Esta función convierte un string en un Buffer, guardando primero su longitud y luego el contenido en UTF-8
function writeString(str: string): Buffer {
    const data = Buffer.from(str, 'utf8');
    if(data.length > 255){
        throw new Error ('String too long');
    }
    return Buffer.concat([Buffer.from([data.length]), data]);
}


//Esta función transforma un número en un Buffer de 8 bytes con formato entero de 64 bits
function writeNumber(num: number): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(num));
    return buf;
}


// Esta función serializa una entrada de transacción (TransactionInput)
function writeInput(input: TransactionInput, parts: Buffer[]) {
    parts.push(writeString(input.utxoId.txId));
    parts.push(writeNumber(input.utxoId.outputIndex));
    parts.push(writeString(input.owner));
    parts.push(writeString(input.signature));
}


// Esta función serializa una salida de transacción (TransactionOutput)
function writeOutput(output: TransactionOutput, parts: Buffer[]) {
    parts.push(writeNumber(output.amount));
    parts.push(writeString(output.recipient));
}


//Esta función convierte una transacción (Transaction) en un formato binario compacto (Buffer)
export function encodeTransaction(transaction: Transaction): Buffer {
    const parts : Buffer[] = [];
    parts.push(writeString(transaction.id));
    parts.push(writeNumber(transaction.timestamp));
    if(transaction.inputs.length > 255){
        throw new Error('Inputs too long');
    }
    parts.push(Buffer.from([transaction.inputs.length]));
    for (const input of transaction.inputs){
        writeInput(input, parts);
    }
    if (transaction.outputs.length > 255){
        throw new Error('Outputs too long');
    }
    parts.push(Buffer.from([transaction.outputs.length]));
    for(const output of transaction.outputs){
        writeOutput(output, parts);
    }
    return Buffer.concat(parts);
}


/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */


//Esta función lee un string desde un Buffer, interpretando primero la longitud y luego los caracteres
function readString(buffer: Buffer, offset: number) : { value: string ,nextOffset: number}{
    const length=buffer.readUInt8(offset);
    const start=offset+1;
    const end=start+length;
    const value= buffer.subarray(start,end).toString('utf8');
    return {value, nextOffset: end};
}
//Esta función lee un número de 8 bytes del Buffer en formato entero de 64 bits
function readNumber(buffer: Buffer,offset: number): { value: number ,nextOffset: number }{
    const value= Number (buffer.readBigUInt64BE(offset));
    return {value, nextOffset: offset+8 };
}


// Esta función reconstruye una entrada de transacción leyendo los datos del Buffer
function readInput(buffer: Buffer, offset: number): { input: TransactionInput, nextOffset: number } {
    const { value: txId, nextOffset: offsetOne } = readString(buffer, offset);
    const { value: outputIndex, nextOffset: offsetTwo } = readNumber(buffer, offsetOne);
    const { value: owner, nextOffset: offsetThree } = readString(buffer, offsetTwo);
    const { value: signature, nextOffset: offsetFour } = readString(buffer, offsetThree);
    return {
        input: {
            utxoId: { txId, outputIndex },
            owner,
            signature
        },
        nextOffset: offsetFour
    };
}


//Esta función reconstruye una salida de transacción leyendo los datos del Buffer
function readOutput(buffer: Buffer, offset: number): { output: TransactionOutput, nextOffset: number } {
    const { value: amount, nextOffset: offsetOne } = readNumber(buffer, offset);
    const { value: recipient, nextOffset: offsetTwo } = readString(buffer, offsetOne);
    return {
        output: { amount, recipient },
        nextOffset: offsetTwo
    };
}


// Esta función reconstruye una transacción a partir de un Buffer
export function decodeTransaction(buffer: Buffer): Transaction {
    let offset= 0;
    const {value: id, nextOffset: offsetOne} = readString(buffer, offset);
    offset=offsetOne;
    const {value: timestamp, nextOffset: offsetTwo} = readNumber(buffer, offset);
    offset=offsetTwo;
    const inputsAmount=buffer.readUInt8(offset);
    offset=offset+1;
    const inputs: TransactionInput [] = [];
    for(let i = 0 ; i < inputsAmount; i++){
        const { input, nextOffset } = readInput(buffer, offset);
        inputs.push(input);
        offset = nextOffset;
    }
    const outputsAmount=buffer.readUInt8(offset);
    offset=offset+1;
    const outputs: TransactionOutput[] = [];
    for(let i = 0 ; i < outputsAmount; i++){
        const { output, nextOffset } = readOutput(buffer, offset);
        outputs.push(output);
        offset = nextOffset;
    }
    return {id, inputs, outputs, timestamp };
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
