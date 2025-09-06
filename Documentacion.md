## Documentación

Para la validación de transacciones, comencé iterando sobre los inputs de la transacción recibida, para asegurarme de que todo lo relativo a ellos fuese correcto. En primer lugar, validé la doble existencia de UTXO mediante un set que trackea los utxos ya usados. Luego, validé la existencia de cada UTXO con ayuda del código provisto en el ejemplo. A continuación, corroboré que la firma fuera valida y finalmente sumé el valor del input a una variable con el total. Luego recorrí los outputs, sumando sus valores a un total y validando que sus montos no fueran cero (para esto fue necesario crear un nuevo código de error en "errors.ts" de nombre: "ZERO_AMOUNT_OUTPUTS, también modificando uno de los tests). Finalmente se valida que el valor total de entradas sea igual al de salidas. 

Una vez que todos los tests de la parte 1 pasaron correctamente, continué con la parte BONUS. Aquí, tanto para encodear como para decodear, me definí funciones auxiliares que encodean/decodean elementos más reducidos de la transacción, permitiendo que el código central sea más claro. Para poder realizar esta parte, fue presiso explorar los diferentes archivos para encontrar la estructura de la transacción y poder encodearla/decodearla correctamente. Observé que todos sus elementos terminaban reduciendose a algún tipo de entero o string, por lo que programé codeadores/decodeadores de los tipos de int/string necesarios. Luego cree funciones auxiliares para los inputs (incluyendo una para el utxoId) y outputs. Finalmente la transacción completa se encodea/decodea en la función principal. Para optimizar el espacio, utilicé campos de tamaño fijo para montos y timestamps (8 bytes), y para el output index encontré que no ocupan más de 2 bytes, por lo que hice una función auxiliar para ellos también. Cabe destacar, que para los inputs y outputs, utilicé prefijos de longitud para decodificarlos correctamente luego. A su vez, incluí una validación de strings demasiado largos, aquí me enfrenté a la desición de hacerlo así o programar un encodeador de strings largos. Concluí que para optimizar, convendría la primera opción ya que los strings en este tipo de transacciones tienden a ser más bien cortos.

Como extra, agregué unas lineas en "assignment.test.ts" que permiten chequear la eficiencia. Estos valores se pueden observar al ejecutar el comando `npm run test:verbose`. Los resultados muestran:

- JSON size: 902 bytes
- Binary size: 741 bytes   
- Space savings: 17.8%

Concluyendo que efectivamente la representación binaria ocupa menos espacio que la JSON.  

