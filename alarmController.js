const expirationInterval = 5 * 60;





const AddAlarms = async (docRef, input) => {
    return new Promise((resolve, reject) => {
        if(!docRef || !input ){
            throw new Error("missing inputs or docRef");
        }
        docRef.set(input).then((item) => {
            if(item.id){
                resolve(item.id);
            }else{
                reject(item)
            }
        }).catch((err) => {
            resolve(err)
        })
       
    })

}

module.exports = {
    createNewSession: createNewSession,
    updateSession:updateSession,
    updateTopics:updateTopics,
    updateLiveData:updateLiveData,
    updateHistory:updateHistory,
    AddAlarms:AddAlarms
}