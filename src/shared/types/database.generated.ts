export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      letter_attachments: {
        Row: {
          byte_size: number | null
          created_at: string
          height: number | null
          id: string
          kind: Database['public']['Enums']['attachment_kind']
          letter_id: string
          location_label: string | null
          mime_type: string | null
          r2_key: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          kind: Database['public']['Enums']['attachment_kind']
          letter_id: string
          location_label?: string | null
          mime_type?: string | null
          r2_key?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database['public']['Enums']['attachment_kind']
          letter_id?: string
          location_label?: string | null
          mime_type?: string | null
          r2_key?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'letter_attachments_letter_id_fkey'
            columns: ['letter_id']
            isOneToOne: false
            referencedRelation: 'letters'
            referencedColumns: ['id']
          },
        ]
      }
      letter_contents: {
        Row: {
          body: string
          created_at: string
          letter_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          letter_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          letter_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'letter_contents_letter_id_fkey'
            columns: ['letter_id']
            isOneToOne: true
            referencedRelation: 'letters'
            referencedColumns: ['id']
          },
        ]
      }
      letters: {
        Row: {
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          delivery_mode: Database['public']['Enums']['delivery_mode'] | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          id: string
          opened_at: string | null
          parent_letter_id: string | null
          replied_at: string | null
          sealed: boolean
          sent_at: string | null
          status: Database['public']['Enums']['letter_status']
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_mode?: Database['public']['Enums']['delivery_mode'] | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          id?: string
          opened_at?: string | null
          parent_letter_id?: string | null
          replied_at?: string | null
          sealed?: boolean
          sent_at?: string | null
          status?: Database['public']['Enums']['letter_status']
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_mode?: Database['public']['Enums']['delivery_mode'] | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          id?: string
          opened_at?: string | null
          parent_letter_id?: string | null
          replied_at?: string | null
          sealed?: boolean
          sent_at?: string | null
          status?: Database['public']['Enums']['letter_status']
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'letters_parent_letter_id_fkey'
            columns: ['parent_letter_id']
            isOneToOne: false
            referencedRelation: 'letters'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'letters_thread_id_fkey'
            columns: ['thread_id']
            isOneToOne: false
            referencedRelation: 'threads'
            referencedColumns: ['id']
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          email_notification_enabled: boolean
          push_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notification_enabled?: boolean
          push_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notification_enabled?: boolean
          push_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_notification_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          job_id: string
          letter_id: string
          user_id: string
        }[]
      }
      complete_notification_job: {
        Args: { p_error?: string; p_job_id: string; p_success: boolean }
        Returns: undefined
      }
      create_draft: {
        Args: { p_parent_letter_id?: string }
        Returns: {
          created_letter_id: string
          created_thread_id: string
        }[]
      }
      delete_letter: { Args: { p_letter_id: string }; Returns: undefined }
      deliver_due_letters: {
        Args: { p_limit?: number }
        Returns: {
          delivered_letter_id: string
          delivered_user_id: string
        }[]
      }
      open_letter: {
        Args: { p_letter_id: string }
        Returns: {
          opened_at: string
          opened_letter_id: string
        }[]
      }
      send_letter: {
        Args: {
          p_delivery_mode: Database['public']['Enums']['delivery_mode']
          p_letter_id: string
          p_sealed: boolean
        }
        Returns: {
          sent_letter_id: string
          window_end: string
          window_start: string
        }[]
      }
    }
    Enums: {
      attachment_kind: 'photo' | 'location'
      delivery_mode: 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise'
      letter_status: 'draft' | 'traveling' | 'delivered'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attachment_kind: ['photo', 'location'],
      delivery_mode: ['few_days', 'few_weeks', 'few_months', 'about_year', 'surprise'],
      letter_status: ['draft', 'traveling', 'delivered'],
    },
  },
} as const
