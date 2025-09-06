
# Documentación - Franco Cagnoli - 310080 - M6C:
## Tarea 1
Para realizar la función validateTransaction tuve que realizar las 4 validaciones necesarias.

- El primer caso que es verificar la existencia del UTXO fue sencillo gracias a las pistas de implementación, las cuales dejaban bastante claro que había que hacer una vez entendías el código, que en mi caso fue lo mas complejo. 

- Realicé dos for, uno que recorra los inputs y otro los outputs, donde además de hacer las verificaciones sumé los montos de cada transacción para compararlos al final del método y corroborar que son iguales.

- Al igual que la primera validación, la tercera estaba explicada en las pistas de implementación, y el método verify ya estaba implementado.

- Por último, para evitar procesar transacciones más de una vez cree un Set de strings al comienzo de la función (elegí un Set en lugar de un array ya que el primero no permite duplicados). Para cada transacción chequeamos si el id ya fue guardado en el Set, y si no aparece entonces lo guardamos.

El único caso de los tests que me costó arreglar fue el de la transacción de monto 0, ya que no comprendía que estaba sucediendo. Finalmente, lo arreglé en el for que recorre los outputs chequenado que no hayan transacciones de amount menor o igual a cero.
Estuve leyendo sobre la Tarea 2 pero me resulta bastanten más desafiante, por lo que prefiero no entregarla en vez de entregar algo que este mal o hecho completamente por inteligencia artificial.