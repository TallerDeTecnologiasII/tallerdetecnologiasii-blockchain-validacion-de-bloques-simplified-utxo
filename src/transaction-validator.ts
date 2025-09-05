import { Transaction, TransactionInput, getUTXOKey } from './types';
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

    // Datos de la transacción sin firmas, para firmar/verificar
    const signingData = this.createTransactionDataForSigning_(transaction);

    // Set para prevenir doble gasto dentro de la misma transacción
    const seenInputs = new Set<string>();

    // Acumuladores de montos 
    let totalInputs = 0;
    let totalOutputs = 0;

    // 1) Verificación de Existencia de UTXO
    // Cada input debe referenciar un UTXO que exista en el pool y no esté gastado
    for (const input of transaction.inputs) {
      const key = getUTXOKey(input.utxoId);
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);

      if (!utxo) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.UTXO_NOT_FOUND,
            `UTXO not found: ${key}`
          )
        );
        // Si no existe, no seguimos validando este input
        continue;
      }

      // 2) Prevención de Doble Gasto
      // Aseguramos que el mismo UTXO no se use dos veces en esta transacción
      if (seenInputs.has(key)) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.DOUBLE_SPENDING,
            `Duplicate UTXO reference: ${key}`
          )
        );
      } else {
        seenInputs.add(key);
      }

      // 3) Verificación de Firma
      // La firma del input debe ser válida para los datos de la transacción
      // usando la clave pública del dueño del UTXO
      const ok = verify(signingData, input.signature, utxo.recipient);
      if (!ok) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.INVALID_SIGNATURE,
            `Invalid signature for UTXO ${key}`
          )
        );
      }

      // Acumulamos monto de entrada
      totalInputs += utxo.amount;
    }

    // 4) Verificación de Balance
    // La suma de inputs debe ser igual a la suma de outputs 
    for (const [i, out] of transaction.outputs.entries()) {
      if (out.amount <= 0) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.NEGATIVE_AMOUNT,
            `Output #${i} has negative amount`
          )
        );
        continue;
      }
      totalOutputs += out.amount;
    }

    if (totalInputs !== totalOutputs) {
      errors.push(
        createValidationError(
          VALIDATION_ERRORS.AMOUNT_MISMATCH,
          `Total inputs (${totalInputs}) !== total outputs (${totalOutputs})`
        )
      );
    }

    // Resultado final
    // Si no hay errores, la transacción es válida
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
