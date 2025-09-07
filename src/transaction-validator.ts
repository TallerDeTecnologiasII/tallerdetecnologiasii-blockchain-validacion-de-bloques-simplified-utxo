import { Transaction, TransactionInput, UtxoId } from './types';
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

  // La documentación se encuentra en el archivo Documentación.md 

  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];
    
    const txId = transaction.id;

    // Compruebo que la transacción tenga inputs y outputs
    if (transaction.inputs.length == 0) 
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_INPUTS, `Empty inputs: ${txId}`));

    if (transaction.outputs.length == 0) 
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_OUTPUTS, `Empty outputs: ${txId}`));

    let inputAmount = 0;
    let outputAmount = 0;
    
    const usedUtxosId: UtxoId[] = []; // Array para guardar los UtxoId que ya han sido usados en la transacción
    
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex++){ // Recorro cada input de la transacción
      let actualUtxoId = transaction.inputs[inputIndex].utxoId;
      const utxo = this.utxoPool.getUTXO(actualUtxoId.txId, actualUtxoId.outputIndex); // Busco el utxo correspondiente al input
      
      // Verifico exixtencia de utxo en el sistema del input actual (si la línea anterior no devuelve null)
      if (utxo){
        // Busco en 'usedUtxosId' si hay un UTXO ya usado en esta transacción que coincida con el actual
        const repeated = usedUtxosId.find(actual => actual.txId == actualUtxoId.txId && actual.outputIndex == actualUtxoId.outputIndex);
        
        // Compruebo que repeated sea vacío (no ha sido usado el UTXO en la transacción)
        if(!repeated){
          // Creo transacción y verifico validez
          const transactionData = this.createTransactionDataForSigning_(transaction);
          let owner = utxo.recipient;
          let signature = transaction.inputs[inputIndex].signature;
          const isValid = verify(transactionData, signature, owner);

          if (!isValid)
            errors.push(createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, `Invalid signature: ${txId}:${utxo.id.txId}`));

          inputAmount += utxo.amount;
          usedUtxosId.push(utxo.id);
        } else {
          errors.push(createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING, `Double speding: ${txId}:${utxo.id.txId}`));
        }
      } else {
        errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, `UTXO not found: ${actualUtxoId.txId}:${actualUtxoId.outputIndex}`));
      }
    }
    
    // Recorro cada input output la transacción
    for (let outputIndex = 0; outputIndex < transaction.outputs.length; outputIndex++){
      
      // Obtengo la cantidad actual y verifico que sea válida
      let actualOutputAmount = transaction.outputs[outputIndex].amount;
      if (actualOutputAmount > 0){
        outputAmount += transaction.outputs[outputIndex].amount;
      } else if (actualOutputAmount == 0) {
        errors.push(createValidationError(VALIDATION_ERRORS.ZERO_AMOUNT, `Zero-amount output: ${txId}:${actualOutputAmount}`));
      } else {
        errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT, `Negative amount output: ${txId}:${actualOutputAmount}`));
      }
    }

    // Compruebo que las cantidades de la transacción coincidan
    if (inputAmount != outputAmount) {
      errors.push(createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH, `Amount mismatch: intput: ${inputAmount}, output: ${outputAmount}`));
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
