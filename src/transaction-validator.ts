import { getUTXOKey, Transaction, TransactionInput } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError,
  ValidationErrorCode
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

    this.verifyUTXOExistance({ transaction, errors });

    this.verifyNoDoubleSpend({ transaction, errors });

    this.verifyNonNegativeOrZeroAmount({ transaction, errors });

    if (
      !this.hasError({ errors, code: VALIDATION_ERRORS.UTXO_NOT_FOUND }) &&
      !this.hasError({ errors, code: VALIDATION_ERRORS.DOUBLE_SPENDING })
    ) {
      this.verifyBalance({ transaction, errors });
      this.verifySignatures({ transaction, errors });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private verifyUTXOExistance({
    transaction,
    errors
  }: {
    transaction: Transaction;
    errors: ValidationError[];
  }) {
    transaction.inputs.forEach((input, i) => {
      const { txId, outputIndex } = input.utxoId;
      const utxo = this.utxoPool.getUTXO(txId, outputIndex);

      if (!utxo) {
        errors.push({
          code: VALIDATION_ERRORS.UTXO_NOT_FOUND,
          message: `UTXO not found: ${txId}:${outputIndex}`
        });
      }
    });
  }

  private verifyNonNegativeOrZeroAmount({
    transaction,
    errors
  }: {
    transaction: Transaction;
    errors: ValidationError[];
  }) {
    transaction.outputs.forEach((output, idx) => {
      if (output.amount <= 0) {
        errors.push({
          code: VALIDATION_ERRORS.NEGATIVE_AMOUNT,
          message: `Output ${idx} tiene monto negativo (${output.amount}).`
        });
      }
    });
  }

  private verifyBalance({
    transaction,
    errors
  }: {
    transaction: Transaction;
    errors: ValidationError[];
  }) {
    const totalInput = transaction.inputs.reduce((acc, input) => {
      const { txId, outputIndex } = input.utxoId;
      const utxo = this.utxoPool.getUTXO(txId, outputIndex)!;
      return acc + utxo.amount;
    }, 0);

    const totalOutput = transaction.outputs.reduce((acc, output) => acc + output.amount, 0);

    if (totalInput != totalOutput)
      errors.push({
        code: VALIDATION_ERRORS.AMOUNT_MISMATCH,
        message: `La suma de entradas (${totalInput}) debe ser igual a la suma de salidas (${totalOutput}).`
      });
  }

  private verifySignatures({
    transaction,
    errors
  }: {
    transaction: Transaction;
    errors: ValidationError[];
  }) {
    const data = this.createTransactionDataForSigning_(transaction);

    transaction.inputs.forEach((input, i) => {
      const { txId, outputIndex } = input.utxoId;
      const utxo = this.utxoPool.getUTXO(txId, outputIndex);
      if (!utxo) return;

      if (utxo.recipient != input.owner) {
        errors.push({
          code: VALIDATION_ERRORS.INVALID_SIGNATURE,
          message: `Input ${i}: el owner del input no coincide con el owner del UTXO (${txId}:${outputIndex}).`
        });
        return;
      }

      const isValid = verify(data, input.signature, input.owner);
      if (!isValid)
        errors.push({
          code: VALIDATION_ERRORS.INVALID_SIGNATURE,
          message: `Input ${i}: firma inválida para ${txId}:${outputIndex}.`
        });
    });
  }

  private verifyNoDoubleSpend({
    transaction,
    errors
  }: {
    transaction: Transaction;
    errors: ValidationError[];
  }) {
    const seen = new Set<string>();

    transaction.inputs.forEach((input, i) => {
      const key = getUTXOKey(input.utxoId);
      if (seen.has(key)) {
        errors.push({
          code: VALIDATION_ERRORS.DOUBLE_SPENDING,
          message: `UTXO ${key} referenciado más de una vez en la misma transacción.`
        });
      } else {
        seen.add(key);
      }
    });
  }

  private hasError({
    errors,
    code
  }: {
    errors: ValidationError[];
    code: ValidationErrorCode;
  }): Boolean {
    return errors.some(e => e.code == code);
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
