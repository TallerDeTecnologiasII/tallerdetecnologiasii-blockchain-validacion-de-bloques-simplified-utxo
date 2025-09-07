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

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];

    const usedUTXOs = new Set<string>();
    let totalInputAmount = 0;

    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      if (output.amount <= 0) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.NEGATIVE_AMOUNT,
          `Output ${i} has invalid amount: ${output.amount}. Amount must be positive.`
        ));
      }
    }

    for (let i = 0; i < transaction.inputs.length; i++) {
      const input = transaction.inputs[i];
      
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex); 
      
      // 1. Verificación de Existencia de UTXO
      if (!utxo) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.UTXO_NOT_FOUND,
          `UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`
        ));
      }

      // 4. Prevención de Doble Gasto
      const utxoKey = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;
      if (usedUTXOs.has(utxoKey)) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.DOUBLE_SPENDING,
          `UTXO ${utxoKey} is used multiple times in this transaction`
        ));
      }
      usedUTXOs.add(utxoKey);

      totalInputAmount += utxo?.amount || 0;

      // 3. Verificación de Firma
      const transactionDataForSigning = this.createTransactionDataForSigning_(transaction);
      
      const isValidSignature = verify(transactionDataForSigning, input.signature, utxo?.recipient || '');
      
      if (!isValidSignature) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.INVALID_SIGNATURE,
          `Invalid signature for input ${i} (UTXO ${utxoKey})`
        ));
      }
    }

    // 2. Verificación de Balance
    const totalOutputAmount = transaction.outputs.reduce((sum, output) => sum + output.amount, 0);
    
    if (totalInputAmount !== totalOutputAmount) {
      errors.push(createValidationError(
        VALIDATION_ERRORS.AMOUNT_MISMATCH,
        `Input amount (${totalInputAmount}) does not match output amount (${totalOutputAmount})`
      ));
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
