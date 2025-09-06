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

    // Verificación de Existencia de UTXO
    // Verificar que todas las entradas de transacción referencien UTXOs existentes y no gastados
    for (const input of transaction.inputs){
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!utxo) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.UTXO_NOT_FOUND,
          `UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`
        ));
      }
    }

    // Verificación de Balance
    // Asegurar que la suma de montos de entrada igualen la suma de montos de salida

    let totalInput = 0;
    for (const input of transaction.inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (utxo) totalInput += utxo.amount;
    }

    let totalOutput = 0;
    for (const output of transaction.outputs) {
      if (output.amount < 0) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.NEGATIVE_AMOUNT,
          `Negative output amount: ${output.amount}`
        ));
      } else if (output.amount === 0) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.ZERO_AMOUNT,
          `Zero output amount not allowed`
        ));
      }

      totalOutput += output.amount;
    }



    if (totalInput !== totalOutput) {
      errors.push(createValidationError(
        VALIDATION_ERRORS.AMOUNT_MISMATCH,
        `Input amount (${totalInput}) does not match output amount (${totalOutput})`
      ));
    }

    // Verificación de Firma
    // Verificar que cada entrada esté firmada por el propietario del UTXO correspondiente
    const dataToSign = this.createTransactionDataForSigning_(transaction);
    for (const input of transaction.inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (utxo) {
        const isValid = verify(dataToSign, input.signature, utxo.recipient);
        if (!isValid) {
          errors.push(createValidationError(
            VALIDATION_ERRORS.INVALID_SIGNATURE,
            `Invalid signature for input referencing UTXO ${input.utxoId.txId}:${input.utxoId.outputIndex}`
          ));
        }
      }
    }
    
    // Prevención de Doble Gasto
    // Asegurar que ningún UTXO sea referenciado múltiples veces dentro de la misma transacción
    const referencedUTXOs: string[] = [];
    for (const input of transaction.inputs) {
      const utxoKey = `${input.utxoId.txId}:${input.utxoId.outputIndex}`;
      if (referencedUTXOs.includes(utxoKey)) {
        errors.push(createValidationError(
          VALIDATION_ERRORS.DOUBLE_SPENDING,
          `UTXO referenced multiple times in transaction: ${utxoKey}`
        ));
      } else {
        referencedUTXOs.push(utxoKey);
      }
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
