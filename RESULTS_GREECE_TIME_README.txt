APEX OMEGA v5.8 — SETTLED MARKETS + GREECE TIME

Νέα συμπεριφορά:
1. Κάθε αγώνας εμφανίζει ώρα έναρξης σε Europe/Athens (ώρα Ελλάδος).
2. Οι ολοκληρωμένοι αγώνες φέρουν ετικέτα «ΟΛΟΚΛΗΡΩΘΗΚΕ» και ευδιάκριτο τελικό σκορ.
3. Στο Post-Match εμφανίζονται χρωματισμένες επιβεβαιώσεις ανά επιβεβαιωμένη αγορά:
   πράσινο = επιβεβαιώθηκε, κόκκινο = δεν επιβεβαιώθηκε, κίτρινο = δεν υπάρχουν επαρκή actual stats.
4. Υποστηριζόμενες κατηγορίες settlement: 1/X/2, 1X/X2/12, Over/Under goals,
   BTTS, corners, cards, exact score, half-time exact score και offsides όταν υπήρχε confirmed signal.
5. Το δεξί Match Analysis drawer δείχνει επίσης COMPLETED + FT score + settlement chips.
6. Τα νέα pre-match confirmed signals αποθηκεύονται frozen στο Vault ώστε η μεταγενέστερη αξιολόγηση
   να μην ανακατασκευάζει εκ των υστέρων προβλέψεις (αποφυγή data leakage).

Σημείωση συμβατότητας:
Παλαιότερες εγγραφές Vault που δεν είχαν αποθηκεύσει frozen multi-market signals δεν ανακατασκευάζονται
τεχνητά. Θα εμφανίσουν μόνο όσα στοιχεία είναι πραγματικά διαθέσιμα.
