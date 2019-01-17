package de.volkerw.hsma.mmi;

import com.google.api.core.ApiFuture;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.concurrent.ExecutionException;

public class Main {

    private static String calendar_uri = "http://services.informatik.hs-mannheim.de/stundenplan/index.php?fach_p%5B%5D=BWL1%401CSB&fach_p%5B%5D=EI%401CSB&fach_p%5B%5D=GAT%401CSB&fach_p%5B%5D=MA1%401CSB&fach_p%5B%5D=PR1-L%401CSB&fach_p%5B%5D=PR1%3DI%401CSB&fach_p%5B%5D=T-MA1%401CSB&fach_p%5B%5D=EI%401IB&fach_p%5B%5D=MA1%401IB&fach_p%5B%5D=NF%401IB&fach_p%5B%5D=PR1-L%401IB&fach_p%5B%5D=PR1%3DI%401IB&fach_p%5B%5D=TEI1%401IB&fach_p%5B%5D=TEI1-L%401IB&fach_p%5B%5D=AMR%401IM&fach_p%5B%5D=COM%3DI%401IM&fach_p%5B%5D=DTP%401IM&fach_p%5B%5D=EBK%401IM&fach_p%5B%5D=GAE%401IM&fach_p%5B%5D=KDM%401IM&fach_p%5B%5D=KRY%401IM&fach_p%5B%5D=MMI%401IM&fach_p%5B%5D=NNW%401IM&fach_p%5B%5D=PPR%401IM&fach_p%5B%5D=SMA%401IM&fach_p%5B%5D=EI%401IMB&fach_p%5B%5D=MA1%401IMB&fach_p%5B%5D=MED1%401IMB&fach_p%5B%5D=MI1%401IMB&fach_p%5B%5D=PR1-L%401IMB&fach_p%5B%5D=PR1%3DI%401IMB&fach_p%5B%5D=T-MA1%401IMB&fach_p%5B%5D=MA2%402IB&fach_p%5B%5D=PR2-L%402IB&fach_p%5B%5D=PR2%3DI%402IB&fach_p%5B%5D=SE1%3DI%402IB&fach_p%5B%5D=TEI2%402IB&fach_p%5B%5D=THI%402IB&fach_p%5B%5D=THI-%DC%402IB&fach_p%5B%5D=AMR%402IM&fach_p%5B%5D=COM%3DI%402IM&fach_p%5B%5D=DTP%402IM&fach_p%5B%5D=EBK%402IM&fach_p%5B%5D=GAE%402IM&fach_p%5B%5D=KDM%402IM&fach_p%5B%5D=KRY%402IM&fach_p%5B%5D=MMI%402IM&fach_p%5B%5D=NNW%402IM&fach_p%5B%5D=PPR%402IM&fach_p%5B%5D=SMA%402IM&fach_p%5B%5D=DM%3DI%403IB&fach_p%5B%5D=MA3%403IB&fach_p%5B%5D=PP%3DI%403IB&fach_p%5B%5D=PR3%3DI%403IB&fach_p%5B%5D=SE2%3DI%403IB&fach_p%5B%5D=WEB%403IB&fach_p%5B%5D=DM%3DI%403IMB&fach_p%5B%5D=MA3%403IMB&fach_p%5B%5D=MI3%403IMB&fach_p%5B%5D=MI4%403IMB&fach_p%5B%5D=SE2%3DI%403IMB&fach_p%5B%5D=WEB%403IMB&fach_p%5B%5D=SEP%404IB&fach_p%5B%5D=BIM%3DI%406IB&fach_p%5B%5D=GDV%406IB&fach_p%5B%5D=IGT%406IB&fach_p%5B%5D=MBI%406IB&fach_p%5B%5D=SMA%406IB&fach_p%5B%5D=SQUAD%406IB&fach_p%5B%5D=VS%406IB&fach_p%5B%5D=WAF%406IB&fach_p%5B%5D=WIA%406IB&fach_p%5B%5D=BIM%3DI%406IMB&fach_p%5B%5D=GDV%406IMB&fach_p%5B%5D=IGT%406IMB&fach_p%5B%5D=MBI%406IMB&fach_p%5B%5D=MED3%406IMB&fach_p%5B%5D=MLD%406IMB&fach_p%5B%5D=SMA%406IMB&fach_p%5B%5D=SQUAD%406IMB&fach_p%5B%5D=VS%406IMB&fach_p%5B%5D=WAF%406IMB&fach_p%5B%5D=WIA%406IMB&fach_p%5B%5D=ZMP%406IMB&fach_p%5B%5D=AGI%407IB&fach_p%5B%5D=APV%407IB&fach_p%5B%5D=CVIS%407IB&fach_p%5B%5D=GAE%407IB&fach_p%5B%5D=LSD%407IB&fach_p%5B%5D=MLE%407IB&fach_p%5B%5D=SSE%407IB&fach_p%5B%5D=VS%407IB&fach_p%5B%5D=WIA%407IB&fach_p%5B%5D=AGI%407IMB&fach_p%5B%5D=APV%407IMB&fach_p%5B%5D=CVIS%407IMB&fach_p%5B%5D=LSD%407IMB&fach_p%5B%5D=MED3%407IMB&fach_p%5B%5D=MLD%407IMB&fach_p%5B%5D=MLE%407IMB&fach_p%5B%5D=SSE%407IMB&fach_p%5B%5D=VS%407IMB&fach_p%5B%5D=WIA%407IMB&fach_p%5B%5D=ZMP%407IMB&msp=1&pplan=weiter";

    public static void main(String[] args) {

        GoogleCredentials credentials = null;
        try {
            InputStream serviceAccount = Main.class.getResourceAsStream("/fireBaseCredentials.json");
            credentials = GoogleCredentials.fromStream(serviceAccount);
        } catch (IOException e) {
            e.printStackTrace();
        }

        FirebaseOptions options = new FirebaseOptions.Builder()
                .setCredentials(credentials)
                .setDatabaseUrl("https://mmi-stundenplan-bot-firebase.firebaseio.com")
                .build();
        FirebaseApp.initializeApp(options);

        FirestoreOptions firestoreOptions =
                FirestoreOptions.newBuilder().setCredentials(credentials).setTimestampsInSnapshotsEnabled(true).build();
        Firestore db = firestoreOptions.getService();

        deleteCollection(db.collection("schedule_entries"), 10);

        Schedule.resolveScheduleEntries(calendar_uri).forEach(scheduleEntry -> {
            DocumentReference docRef = db.collection("schedule_entries").document(scheduleEntry.key());
            ApiFuture<WriteResult> result = docRef.set(scheduleEntry.asMap());
            try {
                result.get();
            } catch (InterruptedException e) {
                e.printStackTrace();
            } catch (ExecutionException e) {
                e.printStackTrace();
            }
        });
    }

    static void deleteCollection(CollectionReference collection, int batchSize) {
        try {
            // retrieve a small batch of documents to avoid out-of-memory errors
            ApiFuture<QuerySnapshot> future = collection.limit(batchSize).get();
            int deleted = 0;
            // future.get() blocks on document retrieval
            List<QueryDocumentSnapshot> documents = future.get().getDocuments();
            for (QueryDocumentSnapshot document : documents) {
                document.getReference().delete();
                ++deleted;
            }
            if (deleted >= batchSize) {
                // retrieve and delete another batch
                deleteCollection(collection, batchSize);
            }
        } catch (Exception e) {
            System.err.println("Error deleting collection : " + e.getMessage());
        }
    }
}
