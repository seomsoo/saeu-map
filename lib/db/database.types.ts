export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          actor: string | null
          at: string
          id: number
          kst_day: string | null
          place_id: string
          type: string
        }
        Insert: {
          actor?: string | null
          at?: string
          id?: never
          kst_day?: string | null
          place_id: string
          type: string
        }
        Update: {
          actor?: string | null
          at?: string
          id?: never
          kst_day?: string | null
          place_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      peel_monthly: {
        Row: {
          month: string
          n: number
          type: string
        }
        Insert: {
          month: string
          n: number
          type: string
        }
        Update: {
          month?: string
          n?: number
          type?: string
        }
        Relationships: []
      }
      peel_results: {
        Row: {
          created_at: string
          id: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: never
          type: string
        }
        Update: {
          created_at?: string
          id?: never
          type?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          created_at: string
          id: string
          key: string
          place_id: string
          removed_at: string | null
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          place_id: string
          removed_at?: string | null
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          place_id?: string
          removed_at?: string | null
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      place_edits: {
        Row: {
          actor: string | null
          at: string
          before: Json
          field: string
          id: string
          place_id: string
        }
        Insert: {
          actor?: string | null
          at?: string
          before: Json
          field: string
          id?: string
          place_id: string
        }
        Update: {
          actor?: string | null
          at?: string
          before?: Json
          field?: string
          id?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_edits_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_edits_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address_jibun: string | null
          address_road: string | null
          created_at: string
          duplicate_suspect_of: string | null
          gu: string
          hidden_at: string | null
          hours_note: string | null
          id: string
          lat: number
          lng: number
          menus: Json
          merged_into: string | null
          name: string
          naver_place_url: string | null
          nearest_station: Json | null
          needs_review: boolean
          removed_by_owner: boolean
          reporter_id: string | null
          seed_ref: string | null
          sides: string[]
          source: string
          specialist: boolean
          tags: string[]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address_jibun?: string | null
          address_road?: string | null
          created_at?: string
          duplicate_suspect_of?: string | null
          gu: string
          hidden_at?: string | null
          hours_note?: string | null
          id?: string
          lat: number
          lng: number
          menus?: Json
          merged_into?: string | null
          name: string
          naver_place_url?: string | null
          nearest_station?: Json | null
          needs_review?: boolean
          removed_by_owner?: boolean
          reporter_id?: string | null
          seed_ref?: string | null
          sides?: string[]
          source: string
          specialist?: boolean
          tags?: string[]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address_jibun?: string | null
          address_road?: string | null
          created_at?: string
          duplicate_suspect_of?: string | null
          gu?: string
          hidden_at?: string | null
          hours_note?: string | null
          id?: string
          lat?: number
          lng?: number
          menus?: Json
          merged_into?: string | null
          name?: string
          naver_place_url?: string | null
          nearest_station?: Json | null
          needs_review?: boolean
          removed_by_owner?: boolean
          reporter_id?: string | null
          seed_ref?: string | null
          sides?: string[]
          source?: string
          specialist?: boolean
          tags?: string[]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_duplicate_suspect_of_fkey"
            columns: ["duplicate_suspect_of"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_duplicate_suspect_of_fkey"
            columns: ["duplicate_suspect_of"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          nickname: string | null
          shadow_banned: boolean
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          nickname?: string | null
          shadow_banned?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          nickname?: string | null
          shadow_banned?: boolean
        }
        Relationships: []
      }
      rate_events: {
        Row: {
          actor: string | null
          at: string
          id: number
          ip_hash: string | null
          kind: string
          place_id: string | null
        }
        Insert: {
          actor?: string | null
          at?: string
          id?: never
          ip_hash?: string | null
          kind: string
          place_id?: string | null
        }
        Update: {
          actor?: string | null
          at?: string
          id?: never
          ip_hash?: string | null
          kind?: string
          place_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          actor: string | null
          contact: string | null
          created_at: string
          id: string
          ip_hash: string | null
          kind: string
          message: string | null
          owner_kind: string | null
          photo_id: string | null
          place_id: string
          reason: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          actor?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          kind: string
          message?: string | null
          owner_kind?: string | null
          photo_id?: string | null
          place_id: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          actor?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          kind?: string
          message?: string | null
          owner_kind?: string | null
          photo_id?: string | null
          place_id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          photo_at: string | null
          photo_key: string | null
          place_id: string
          rating: number
          text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          photo_at?: string | null
          photo_key?: string | null
          place_id: string
          rating: number
          text?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          photo_at?: string | null
          photo_key?: string | null
          place_id?: string
          rating?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subway_exits: {
        Row: {
          exit_no: string | null
          id: number
          lat: number
          lines: string[]
          lng: number
          station: string
        }
        Insert: {
          exit_no?: string | null
          id?: never
          lat: number
          lines?: string[]
          lng: number
          station: string
        }
        Update: {
          exit_no?: string | null
          id?: never
          lat?: number
          lines?: string[]
          lng?: number
          station?: string
        }
        Relationships: []
      }
    }
    Views: {
      places_public: {
        Row: {
          address_jibun: string | null
          address_road: string | null
          check_count: number | null
          created_at: string | null
          gu: string | null
          hours_note: string | null
          id: string | null
          is_new: boolean | null
          last_checked_at: string | null
          lat: number | null
          lng: number | null
          menus: Json | null
          name: string | null
          naver_place_url: string | null
          nearest_station: Json | null
          photos: Json | null
          rating_avg: number | null
          rating_count: number | null
          sides: string[] | null
          source: string | null
          specialist: boolean | null
          tags: string[] | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          created_at: string | null
          edited_at: string | null
          id: string | null
          nickname: string | null
          photo_key: string | null
          place_id: string | null
          rating: number | null
          text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_user: { Args: { p_uid: string }; Returns: undefined }
      admin_merge_places: {
        Args: { p_from: string; p_into: string }
        Returns: {
          freed_photo_key: string
          freed_place_id: string
        }[]
      }
      admin_merge_users: {
        Args: { p_from: string; p_into: string }
        Returns: {
          freed_photo_key: string
          freed_place_id: string
        }[]
      }
      admin_places: {
        Args: {
          p_id?: string
          p_ids?: string[]
          p_limit?: number
          p_needs_review?: boolean
          p_query?: string
        }
        Returns: {
          address_jibun: string | null
          address_road: string | null
          created_at: string
          duplicate_suspect_of: string | null
          gu: string
          hidden_at: string | null
          hours_note: string | null
          id: string
          lat: number
          lng: number
          menus: Json
          merged_into: string | null
          name: string
          naver_place_url: string | null
          nearest_station: Json | null
          needs_review: boolean
          removed_by_owner: boolean
          reporter_id: string | null
          seed_ref: string | null
          sides: string[]
          source: string
          specialist: boolean
          tags: string[]
          updated_at: string
          verified_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_stats: { Args: never; Returns: Json }
      apply_suggestion: {
        Args: { p_field: string; p_place: string; p_value: Json }
        Returns: undefined
      }
      delete_review: {
        Args: { p_id: string }
        Returns: {
          deleted_photo_key: string
          deleted_place_id: string
        }[]
      }
      me: { Args: never; Returns: Json }
      merge_target: { Args: { p_id: string }; Returns: string }
      my_reports: {
        Args: never
        Returns: {
          address_jibun: string | null
          address_road: string | null
          check_count: number | null
          created_at: string | null
          gu: string | null
          hours_note: string | null
          id: string | null
          is_new: boolean | null
          last_checked_at: string | null
          lat: number | null
          lng: number | null
          menus: Json | null
          name: string | null
          naver_place_url: string | null
          nearest_station: Json | null
          photos: Json | null
          rating_avg: number | null
          rating_count: number | null
          sides: string[] | null
          source: string | null
          specialist: boolean | null
          tags: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "places_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      peel_stats: { Args: never; Returns: Json }
      photo_slot_ok: { Args: { p_place?: string }; Returns: boolean }
      season_stats: { Args: never; Returns: Json }
      submit_report: {
        Args: {
          p_duplicate_of?: string
          p_gu: string
          p_hours_note: string
          p_lat: number
          p_lng: number
          p_menus: Json
          p_name: string
          p_naver_place_url: string
          p_sides: string[]
          p_tags: string[]
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

