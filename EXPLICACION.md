## Enfoque y desafíos enfrentados

### Tarea 1
El enfoque utilizado para la validación de transacciones, se centró en realizar las verificaciones expuestas en la letra del ejercicio. Primero, aseguré que todos los UTXOs de entradas existieran en el pool, ya que un de lo contrario significaría que ya fue gastado o que es inválido. Luego, verifiqué la validez de los outputs e implementé la verificación de balance, sumando los montos de todas las entradas y comparándolos con los montos de las salidas. Por último, validé la firma y prevención de doble gastos.

En esta parte me enfrenté al desafio de modificar el test  `REQUIRED: should reject zero-amount outputs`, que como fue mencionado en el foro, estaba incorrecto. Para solucionarlo, tome la decisión de crear un nuevo código de error `INVALID_OUTPUT_AMOUNT` que es lanzado en caso de que un output tenga monto negativo o igual a 0.

### Tarea 2
Para esta tarea opté por el siguiente enfoque: Para los campos `amount` y `timestamp`, así como se sugiere en la letra, utilicé buffers de 8 bytes. El otro número a codificar es el `outputIndex`, que opté por codificarlo usando 1 byte para optimizar rendimiento y ahorrar espacio. Además agregue validaciones en las funciones para decodificar números y strings, que lanzan una excepción describiendo el problema en caso de que el largo del buffer sea menor al esperado.