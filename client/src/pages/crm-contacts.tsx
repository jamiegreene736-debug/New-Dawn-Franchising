import { CrmLayout } from "@/components/crm-layout";
import { ContactsManager } from "@/components/contacts-manager";

// Standalone `/crm/contacts` route. The list itself lives in <ContactsManager> so
// it can be reused as the "Contacts" tab inside the Marketing Academy CRM shell
// (client/src/pages/crm.tsx) without dragging the sidebar layout along.
export default function CrmContactsPage() {
  return (
    <CrmLayout>
      <div className="p-6">
        <ContactsManager />
      </div>
    </CrmLayout>
  );
}
