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
  constructor(private utxoPool: UTXOPoolManager) { }

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];

    transaction.inputs.forEach(input => {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.UTXO_NOT_FOUND,
          `UTXO not found: ${input.utxoId.txId}: ${input.utxoId.outputIndex}`
        ));
      }
    });

    let inputSum = 0;
    let outputSum = 0;
    transaction.inputs.forEach(input => {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (utxo) inputSum += utxo.amount;
    });
    transaction.outputs.forEach(output => outputSum += output.amount);
    if (inputSum != outputSum) {
      errors.push(createValidationError(
        VALIDATION_ERRORS.AMOUNT_MISMATCH,
        `Input and output amounts are mismatched`
      ));
    }

    const transactionData = this.createTransactionDataForSigning_(transaction);
    transaction.inputs.forEach(input => {
      const isValid = verify(transactionData, input.signature, input.owner);
      if (!isValid) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.INVALID_SIGNATURE,
          `${input.owner} signature is invalid`
        ));
      }
    });

    const seen: string[] = [];
    transaction.inputs.forEach(input => {
      const utxoKey = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;

      if (seen.includes(utxoKey)) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.DOUBLE_SPENDING,
          `UTXO referenced multiple times in same transaction: ${utxoKey}`
        ));
      } else {
        seen.push(utxoKey);
      }

    });

    transaction.outputs.forEach(output => {
      if (output.amount == 0) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.ZERO_AMOUNT,
          `Output amount is zero`
        ));
      }
    });

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
