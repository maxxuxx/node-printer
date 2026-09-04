export type PrintDeliveryStage =
  | "transmitted"
  | "spooled"
  | "acknowledged";

export type PrintDeliveryConfirmation =
  | "serial-drain"
  | "tcp-write"
  | "device-status"
  | "winspool-job"
  | "cups-job"
  | "bluetooth-write";

export interface PrintDelivery {
  stage       : PrintDeliveryStage;
  confirmedBy : PrintDeliveryConfirmation;
  partial    ?: boolean;
}
