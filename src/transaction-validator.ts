import {getUTXOKey, Transaction, TransactionInput} from './types';
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

    // Esta función verifica que la transacción tenga al menos una entrada y una salida
    private validateNonEmptyInputsAndOutputs(transaction: Transaction): ValidationError[] {
        const errors: ValidationError[] = [];
        if (transaction.inputs.length === 0) {
            errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_INPUTS, 'Empty inputs'));
        }
        if (transaction.outputs.length === 0) {
            errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_OUTPUTS, 'Empty outputs'));
        }
        return errors;
    }


    /*Esta función recorre todas las salidas de la transacción, verifica que cada salida tenga un monto
    estrictamente mayor a 0, suma los montos de las salidas y al final verifica si coincide o no el
    monto total de las entradas con el monto total de las salidas*/
    private validateBalance(inputsTotal: number, transaction: Transaction): ValidationError[] {
        const errors: ValidationError[] = [];
        let outputsTotal = 0;
        for (const output of transaction.outputs) {
            if (output.amount <= 0) {
                errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT,
                    `Output amount can not be negative or zero: ${output.amount}`));
            }
            outputsTotal += output.amount;
        }
        if (inputsTotal !== outputsTotal) {
            errors.push(createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH,
                `AMOUNTS MISMATCH: ${inputsTotal} != ${outputsTotal}`));
        }
        return errors;
    }

    // Esta función previene que un mismo UTXO sea utilizado más de una vez dentro de la misma transacción
    private validateDoubleSpending(input: TransactionInput, utxos: Set<string>, errors: ValidationError[]): void {
        const utxoKey = getUTXOKey(input.utxoId);
        if (utxos.has(utxoKey)) {
            errors.push(createValidationError(
                VALIDATION_ERRORS.DOUBLE_SPENDING,
                `This UTXO is referenced multiple times within the same transaction: ${utxoKey}`
            ));
        } else {
            utxos.add(utxoKey);
        }
    }


    // Esta función verifica que cada entrada está firmada por el propietario del UTXO correspondiente.
    private validateInputSignature(transaction: Transaction, input: TransactionInput, errors: ValidationError[]): void {
        const transactionData = this.createTransactionDataForSigning_(transaction);
        const isValid = verify(transactionData, input.signature, input.owner);
        if (!isValid) {
            errors.push(createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, `invalid signature`));
        }
    }

    validateTransaction(transaction: Transaction): ValidationResult {
        const errors: ValidationError[] = [];
        let imputTotal=0;
        const utxos = new Set<string>();
        errors.push(...this.validateNonEmptyInputsAndOutputs(transaction));
        for(const input of transaction.inputs) {
            // 1) Esta primer parte verifica la existencia de UTXO
            const utxo=this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
            if (!utxo) {
                errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND,
                    `Utxo not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`));
            }else{
                if (utxo.amount <= 0) {
                    errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT,`Utxo amount must be positive`));
                }
                imputTotal=imputTotal+ utxo.amount;
                this.validateInputSignature(transaction, input, errors);
                this.validateDoubleSpending(input, utxos, errors);
            }
        }
        errors.push(...this.validateBalance(imputTotal, transaction));
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
