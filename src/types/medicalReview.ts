export type MedicalReviewStatus = 'DRAFT' | 'PENDING_LOCAL' | 'EXPORTED';

export interface MedicalReviewRequest {
  id: string;
  profile_id: string;
  date_range: {
    from?: string;
    to?: string;
  };
  record_ids: string[];
  checkin_ids: string[];
  observations?: string;
  status: MedicalReviewStatus;
  data_origin: 'SELF_REPORTED' | 'SYNTHETIC';
  source: string;
  created_at: string;
  updated_at: string;
}

export type MedicalReviewRequestInput = Omit<
  MedicalReviewRequest,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
};
