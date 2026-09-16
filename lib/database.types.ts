export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Question types supported by the form builder
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'dropdown'
  | 'checkboxes'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'rating'
  | 'opinion_scale'
  | 'yes_no'
  | 'file_upload'
  | 'url'
  | 'matrix'

// Form status
export type FormStatus = 'draft' | 'published' | 'closed'

// Theme presets
export type ThemePreset = 
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lavender'
  | 'minimal'

export interface ThemeConfig {
  id: ThemePreset
  name: string
  primaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: string
}

export interface MatrixRow {
  id: string
  label: string
  description?: string
}

export interface MatrixColumn {
  id: string
  label: string
  shortLabel?: string
}

// Question configuration
export interface QuestionConfig {
  id: string
  type: QuestionType
  title: string
  description?: string
  displayNumber?: string | number
  required?: boolean
  // Type-specific options
  options?: string[] // For dropdown and checkboxes
  maxSelect?: number // Maximum selectable options for checkboxes
  exclusiveOptions?: string[] // Options that when selected deselect all others
  matrixRows?: MatrixRow[] // For matrix grid
  matrixColumns?: MatrixColumn[] // For matrix grid
  minValue?: number // For rating (1-5 stars) or opinion_scale (1-10)
  maxValue?: number
  allowedFileTypes?: string[] // For file_upload
  maxFileSize?: number // In MB
  placeholder?: string
}

// Database tables
export interface Database {
  public: {
    Tables: {
      forms: {
        Row: {
          id: string
          is_singleton?: boolean
          title: string
          description: string | null
          slug: string
          status: FormStatus
          theme: ThemePreset
          questions: QuestionConfig[]
          thank_you_message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_singleton?: boolean
          title?: string
          description?: string | null
          slug: string
          status?: FormStatus
          theme?: ThemePreset
          questions?: QuestionConfig[]
          thank_you_message?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_singleton?: boolean
          title?: string
          description?: string | null
          slug?: string
          status?: FormStatus
          theme?: ThemePreset
          questions?: QuestionConfig[]
          thank_you_message?: string
          updated_at?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          id: string
          form_id: string
          answers: Record<string, Json>
          respondent_hash: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          form_id?: string
          answers: Record<string, Json>
          respondent_hash?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Record<string, Json>
          respondent_hash?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          form_id: string
          question_key: string
          order_index: number
          type: string
          title: string
          description: string | null
          display_number: string | null
          required: boolean
          placeholder: string | null
          min_value: number | null
          max_value: number | null
          max_select: number | null
          exclusive_options: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          form_id: string
          question_key: string
          order_index?: number
          type: string
          title: string
          description?: string | null
          display_number?: string | null
          required?: boolean
          placeholder?: string | null
          min_value?: number | null
          max_value?: number | null
          max_select?: number | null
          exclusive_options?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          form_id?: string
          question_key?: string
          order_index?: number
          type?: string
          title?: string
          description?: string | null
          display_number?: string | null
          required?: boolean
          placeholder?: string | null
          min_value?: number | null
          max_value?: number | null
          max_select?: number | null
          exclusive_options?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          question_id: string
          label: string
          value: string | null
          order_index: number
          is_exclusive: boolean
        }
        Insert: {
          id?: string
          question_id: string
          label: string
          value?: string | null
          order_index?: number
          is_exclusive?: boolean
        }
        Update: {
          id?: string
          question_id?: string
          label?: string
          value?: string | null
          order_index?: number
          is_exclusive?: boolean
        }
        Relationships: []
      }
      question_matrix_rows: {
        Row: {
          id: string
          question_id: string
          row_key: string
          label: string
          description: string | null
          order_index: number
        }
        Insert: {
          id?: string
          question_id: string
          row_key: string
          label: string
          description?: string | null
          order_index?: number
        }
        Update: {
          id?: string
          question_id?: string
          row_key?: string
          label?: string
          description?: string | null
          order_index?: number
        }
        Relationships: []
      }
      question_matrix_columns: {
        Row: {
          id: string
          question_id: string
          col_key: string
          label: string
          short_label: string | null
          order_index: number
        }
        Insert: {
          id?: string
          question_id: string
          col_key: string
          label: string
          short_label?: string | null
          order_index?: number
        }
        Update: {
          id?: string
          question_id?: string
          col_key?: string
          label?: string
          short_label?: string | null
          order_index?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      submit_survey_response: {
        Args: {
          p_form_id: string
          p_answers: Json
          p_respondent_hash?: string | null
        }
        Returns: Json
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

// Convenience types
export type Form = Database['public']['Tables']['forms']['Row']
export type FormInsert = Database['public']['Tables']['forms']['Insert']
export type FormUpdate = Database['public']['Tables']['forms']['Update']
export type Response = Database['public']['Tables']['responses']['Row']
export type ResponseInsert = Database['public']['Tables']['responses']['Insert']
export type NormalizedQuestion = Database['public']['Tables']['questions']['Row']
export type NormalizedQuestionInsert = Database['public']['Tables']['questions']['Insert']
export type NormalizedQuestionOption = Database['public']['Tables']['question_options']['Row']
export type NormalizedMatrixRow = Database['public']['Tables']['question_matrix_rows']['Row']
export type NormalizedMatrixColumn = Database['public']['Tables']['question_matrix_columns']['Row']

