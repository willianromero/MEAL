import string

def extract_printable_strings(doc_path, txt_path):
    with open(doc_path, 'rb') as f:
        data = f.read()
    
    # Extraer secuencias de caracteres imprimibles de longitud >= 4
    printable = set(string.printable.encode('ascii'))
    current = bytearray()
    strings = []
    
    for b in data:
        if b in printable:
            current.append(b)
        else:
            if len(current) >= 4:
                try:
                    s = current.decode('utf-8', errors='ignore').strip()
                    if s:
                        strings.append(s)
                except Exception:
                    pass
            current = bytearray()
            
    if len(current) >= 4:
        strings.append(current.decode('utf-8', errors='ignore').strip())
        
    # Guardar a archivo txt limpio
    with open(txt_path, 'w', encoding='utf-8') as f_out:
        for s in strings:
            # Filtrar basura binaria y guardar líneas largas
            if len(s) > 10 or any(word in s.lower() for word in ['contrato', 'clinica', 'maicao', 'consultoria', 'pago', 'reforma']):
                f_out.write(s + "\n")

if __name__ == '__main__':
    extract_printable_strings('CONTRATO DE CONSULTORIA INTEGRAL CLINICA MAICAO No (1).doc', 'CONTRATO_MAICAO_TEXT.txt')
    print("Extracción completada.")
