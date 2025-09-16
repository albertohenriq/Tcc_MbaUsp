import grpc
from concurrent import futures
import time
import json
import structlog
import uuid
from app.generated import processing_pb2, processing_pb2_grpc

logger = structlog.get_logger()

class ProcessingServicer(processing_pb2_grpc.ProcessingServiceServicer):
    def ProcessData(self, request, context):
        start_time = time.time()
        
        try:
            logger.info("grpc_request_received", 
                       data={
                           "field1": request.field1,
                           "field2": request.field2,
                           "field3": request.field3
                       })
            
            # Simula processamento
            time.sleep(0.1)
            
            response = processing_pb2.ProcessResponse(
                message="Dados processados com sucesso via gRPC",
                success=True,
                processedId=str(uuid.uuid4()),
                timestamp=int(time.time())
            )
            
            logger.info("grpc_request_processed", response=str(response))
            return response
            
        except Exception as e:
            logger.error("grpc_request_error", error=str(e))
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    processing_pb2_grpc.add_ProcessingServiceServicer_to_server(
        ProcessingServicer(), server
    )
    server.add_insecure_port('[::]:50052')
    server.start()
    logger.info("gRPC server started on port 50052")
    server.wait_for_termination()
