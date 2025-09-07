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

    let totalInput = 0;
    let totalOutput = 0;

    // 1. Verificación de Existencia de UTXO
    for (const input of transaction.inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
        const error: ValidationError = createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, `UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`);
        errors.push(error);
      } else {
          totalInput += utxo.amount; // sumamos al total de los inputs (2)
      }
    }

    // Verificación de outputs

    for (const output of transaction.outputs) {
      if (output.amount <= 0) {
        const error: ValidationError = createValidationError(VALIDATION_ERRORS.INVALID_OUTPUT_AMOUNT, `Invalid output amount: ${output.amount}`);
        errors.push(error);
      }
    }

    // 2. Verificación de Balance
    
    totalOutput = transaction.outputs.reduce((total, utxo) => total + utxo.amount, 0);

    if (totalInput !== totalOutput) {
      const error: ValidationError = createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH, `Input amounts do not match output amounts`);
      errors.push(error);
    }

    // 3. Verificación de Firma
    for (const input of transaction.inputs) {
      const transactionData = this.createTransactionDataForSigning_(transaction);
      const isValid = verify(transactionData, input.signature, input.owner);
      if (!isValid) {
        const error: ValidationError = createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, `Invalid signature for input: ${input.utxoId.txId}:${input.utxoId.outputIndex}`);
        errors.push(error);
      }
    }

    // 4. Prevención de Doble Gastos
    const seenUTXOs = new Set<string>();

    for (const input of transaction.inputs) {
      const utxoId = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;
      if (seenUTXOs.has(utxoId)) {
        const error: ValidationError = createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING, `UTXO already spent: ${utxoId}`);
        errors.push(error);
      }
      seenUTXOs.add(utxoId);
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