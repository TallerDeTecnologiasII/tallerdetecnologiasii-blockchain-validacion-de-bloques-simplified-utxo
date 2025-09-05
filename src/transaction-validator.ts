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

    this.checkEmpty(transaction, errors);
    this.checkDoubleSpendingAndExistence(transaction, errors);
    this.checkSignatures(transaction, errors);
    this.checkOutputs(transaction, errors);
    this.checkBalance(transaction, errors);

    return { valid: errors.length === 0, errors };
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

  /* --------------------------------- Helpers -------------------------------- */

  private isEmpty(list: any[]): boolean {
    if (!list || list.length === 0) {
      return true;
    }
    return false;
  }

  private checkEmpty(transaction: Transaction, errors: ValidationError[]) {
    if (this.isEmpty(transaction.inputs)) {
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_INPUTS, 'La transaccion no tiene entradas'));
    }
    if (this.isEmpty(transaction.outputs)) {
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_OUTPUTS, 'La transaccion no tiene salidas'));
    }
  }

  private checkDoubleSpendingAndExistence(transaction: Transaction, errors: ValidationError[]) {
    const seen = new Set<string>();

    const inputs = transaction.inputs;
    for (let input of inputs) {
      const key = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;
      if (seen.has(key)) {
        errors.push(
          createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING, `Entrada duplicada ${key}`)
        );
      }

      seen.add(key);

      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
        errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, 'UTXO no encontrado'));
      }
    }
  }

  private checkSignatures(transaction: Transaction, errors: ValidationError[]) {
    const data = this.createTransactionDataForSigning_(transaction);
    const inputs = transaction.inputs;
    for (let input of inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) continue;

      const valid = verify(data, input.signature, utxo.recipient);
      if (!valid) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.INVALID_SIGNATURE,
            `Firma inválida para UTXO: txId=${input.utxoId.txId}, outputIndex=${input.utxoId.outputIndex}`
          )
        );
      }
    }
  }

  private checkOutputs(transaction: Transaction, errors: ValidationError[]) {
    const outputs = transaction.outputs;
    for (let output of outputs) {
      if (output.amount <= 0) {
        errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT, `Salida negativa`));
      }
    }
  }

  private checkBalance(transaction: Transaction, errors: ValidationError[]) {
    let sumInputs = 0;
    let sumOutputs = 0;
    const inputs = transaction.inputs;
    const outputs = transaction.outputs;

    for (let input of inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (utxo) sumInputs += utxo.amount;
    }

    for (const output of outputs) {
      sumOutputs += output.amount;
    }

    if (sumInputs !== sumOutputs) {
      errors.push(
        createValidationError(
          VALIDATION_ERRORS.AMOUNT_MISMATCH,
          `Suma entradas (${sumInputs}) != suma salidas (${sumOutputs})`
        )
      );
    }
  }
}
