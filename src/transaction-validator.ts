import { Transaction, TransactionInput } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];
    const seenUTXOs = new Set<string>(); //para guardar los utxos vistos y evitar duplicados

    let totalInput = 0;
    let totalOutput = 0;

    const txData = this.createTransactionDataForSigning_(transaction);

    for (const input of transaction.inputs) {
      //verificacion de existencia del utxo
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
        errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, 
          `UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`));
        continue;
      }

      //chequeamos el set de seenUTXOs para ver si ya fue procesado, sino lo fue lo agregamos
      const utxoKey = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;
      if (seenUTXOs.has(utxoKey)) {
        errors.push(createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING, 
          `Double spend detected: ${utxoKey}`));
      }
      seenUTXOs.add(utxoKey);

      //verificamos la firma
      const isValid = verify(txData, input.signature, utxo.recipient);
      if (!isValid) {
        errors.push(createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, 
          `Invalid signature for UTXO: ${utxoKey}`));
      }
    
      totalInput += utxo.amount;
    }
    //chequeo caso amount 0
    for (const output of transaction.outputs) {
      totalOutput += output.amount;
      if (output.amount <= 0) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.NEGATIVE_AMOUNT,
          `Invalid output amount: ${output.amount}`
        ));
      }
    }
    // verificacion de balance
    if (totalInput !== totalOutput) {
      errors.push(createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH, 
        `Input sum (${totalInput}) does not match output sum (${totalOutput})`));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}
