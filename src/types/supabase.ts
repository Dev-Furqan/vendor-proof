type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: GenericTable;
      users: GenericTable;
      memberships: GenericTable;
      properties: GenericTable;
      vendors: GenericTable;
      vendor_contacts: GenericTable;
      vendor_invites: GenericTable;
      requirement_templates: GenericTable;
      vendor_requirements: GenericTable;
      documents: GenericTable;
      document_versions: GenericTable;
      document_reviews: GenericTable;
      reminder_schedules: GenericTable;
      communications: GenericTable;
      tasks: GenericTable;
      subscriptions: GenericTable;
      invoices: GenericTable;
      audit_logs: GenericTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
